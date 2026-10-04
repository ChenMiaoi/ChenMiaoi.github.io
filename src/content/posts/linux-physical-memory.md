---
title: Linux 物理内存
published: 2026-09-20
description: ''
image: ''
tags:
  - Linux
  - 内存管理
category: linux
series: linux-memory-management
seriesOrder: 1
lang: zh_CN
draft: false
---

物理内存是指系统中能够被至少一个处理器核心任意寻址的全部内存。通常它由RAM 模块构成，也可能包括其他形式的随机访问存储设备。本章将介绍内核如何管理、分配并抽象这一资源。

在 Linux 内核中，物理地址使用 `phys_addr_t` 类型表示，其位宽等于机器字长；并且，内核将内存划分为较大的块，称为**页(page)**。体系结构的基础页大小是硬件配置所支持的最小页大小，也就是内存管理的基本单位。内核的基础页大小由 `PAGE_SIZE` 表示，其数值取决于体系结构，并在相应的 `arch/<header.h>` 中声明：

``` c
架构 select HAVE_PAGE_SIZE_*
          ↓
通用 CONFIG_PAGE_SIZE_*
          ↓
CONFIG_PAGE_SHIFT
          ↓
include/vdso/page.h 中的 PAGE_SHIFT、PAGE_SIZE


select HAVE_PAGE_SIZE_4KB
          ↓
config PAGE_SIZE_4KB
	bool "4KiB pages"
	depends on HAVE_PAGE_SIZE_4KB
          ↓
config PAGE_SHIFT
	int
	default 12 if PAGE_SIZE_4KB
          ↓
#define PAGE_SHIFT      CONFIG_PAGE_SHIFT
#define PAGE_SIZE       (_AC(1,UL) << CONFIG_PAGE_SHIFT)
```

在采用 **非统一内存访问(NUMA，Non-Uniform Memory Access)** 架构的系统中，内核使用 **节点(node)** 管理具有不同访问局部性的内存；一个节点可以包含多个不连续的物理地址范围。**每个物理内存页只属于一个节点**。在每个节点内部，内存还会按物理地址范围划分**区域(zone)**。每个具体的 zone 只属于一个节点，但同一种 zone 类型可以出现在多个节点中。

> NUMA，是一种多处理器系统的存储架构，其核心特点是：**CPU 访问不同位置的内存，速度不一样**。
> 在 NUMA 系统中，CPU 和内存被划分成多个 NUMA 节点。每个节点通常包含一组 CPU 核心和一部分内存，节点之间通过高速互连通信。

为了高效分配内存，内核每次会以分配数量为 2 的幂次方的基础页。分配阶数(order)就是这个幂次，例如，`order-3` 分配包含了 $2^3 = 8$ 个基础页。

内存还会划分为**页块(page block)**，页块的阶数在内核中由 `pageblock_order` 定义。例如，当 `pageblock_order` 为 9 时，每个页块包含 $2^9 = 512$ 个页；其具体取值取决于体系结构和内核配置。页块是内核按迁移类型(migratetype)分组管理页的基本粒度，后文会进一步介绍。

下图将上述概念放在同一个简化布局中。图中假设基础页大小为 4 KiB、`pageblock_order = 9`，因此一个页块为 2 MiB；蓝色的连续 8 页表示一次 `order = 3` 的分配，共 32 KiB。分配阶数表示本次分配的大小，并不是页块之下新增的固定层级。

![Linux 物理内存布局：每个 NUMA 节点包含自己的 zone，zone 内按页块管理基础页；order 为 3 的分配包含连续 8 页。](/images/posts/linux-physical-memory.svg)

*图：node、zone、pageblock 与 page 的关系。仅展示一种可能的布局，实际地址范围与 zone 类型由硬件及内核配置决定。节点与区域的关系参见 [Linux 内核物理内存文档](https://docs.kernel.org/mm/physical_memory.html)。*

# struct page

为了管理内存页，内核设计了一个数据结构用于保存其元数据：用于标识页面属性的标志、用于判断页面能否释放的引用计数，以及大量取决于页面用途的其他元数据。

``` c
struct page {
	memdesc_flags_t flags;

	union {
		/* ... (metadata union) ... */
	};

	union {		/* This union is 4 bytes in size. */
		unsigned int page_type;
		atomic_t _mapcount;
	};

	/* Usage count. *DO NOT USE DIRECTLY*. See page_ref.h */
	atomic_t _refcount;

#ifdef CONFIG_MEMCG
	unsigned long memcg_data;
#endif
} _struct_page_alignment;
```

> 为了不直接粘贴大量源码，此处省略了部分代码，其中部分代码会在后文进行介绍。并且，**后文的所有讲解都是基于配置合理的 64 位小端体制结构**。避免被内核配置和平台的各种组合细节淹没。

`struct page` 在现代 64 位操作系统中包含以下字段：

- `flags`：用于记录页面属性，也会编码区域信息以及可选的节点信息。
  - 可以通过 `set_page_zone` 和 `set_page_node` 设置，并通过 `page_zonenum` 和 `page_to_nid` 读取
- `metadata unoin`：一个 40 字节的元数据联合体，其成员是一系列数据结构，具体取决于页面用途。**用于保存相应类型页面的元数据**。
  - 如果是 `slab` 页（后文介绍），整个 `struct page` 将会被转为 `struct slab` 对象，两者共用 `flags`、`_refcount` 和 `memcg_data` 字段，但 `slab` 会覆盖元数据联合体以及 `_mapcount/page_type` 字段
- `_mapcount/page_type`：对于非 `slab` 页面，则由 `page_type` 字段说明页面类型；`_mapcount` 用于记录页面对该页的映射次数，并由 `page_mapcount` 进行访问。
- `_refcount`：用于判断页面能否释放，应通过 `page_ref_count` 访问
  - `get_page` 会增加计数，`put_page` 会减少该计数
- `memcg_data`：用于保存内存控制组(memory cgroup) 的相关数据，通常是指向某个 `cgroup` 数据结构的指针。
