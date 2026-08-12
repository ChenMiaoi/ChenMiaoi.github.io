---
title: EROFS 总览：把只读镜像当成“可直接访问的压缩归档”
published: 2026-07-23T09:00:00+08:00
description: 从一个具体问题出发，理解 EROFS 的设计目标、分层架构，以及为什么它把不可变镜像、内联数据和透明压缩放进同一个格式。
image: ''
tags:
  - Linux
  - 文件系统
  - EROFS
  - 内核源码
category: linux
series: linux-erofs
seriesOrder: 1
lang: zh_CN
draft: false
---

EROFS，全称 Enhanced Read-Only File System，是一种面向“只读镜像”的 Linux 文件系统。它的目标不是为频繁写入的数据库、用户目录提供一个通用的可写文件系统，而是把已经构建好的文件树，以一种紧凑、稳定、适合读取的方式发布出去。系统镜像、固件、容器镜像、应用沙箱和只读数据集，都属于它擅长的场景。

这里的“只读”并不只是把一个普通文件系统临时挂成只读，而是写入能力直接体现在文件系统的设计目标中：镜像生成后保持不变，部署时可以做到内容完全一致，运行时只负责查找和读取文件。需要写入时，通常把 EROFS 作为底层只读层，再通过 OverlayFS 等机制把新增和修改重定向到其他可写文件系统。

它解决的是“如何高效地分发和使用一棵不会改变的文件树”这个问题。传统的 `tar`、`zip` 等归档文件很适合保存和传输，但要访问其中的文件，通常需要先解包，或者由额外的用户态程序解释归档格式；而普通可写文件系统又需要维护面向修改的元数据和一致性机制。EROFS 则把目录、inode、权限、符号链接等文件系统信息直接组织在镜像中，并由 Linux 内核通过 VFS 提供标准的文件系统接口。因此，镜像挂载后可以像普通目录一样执行路径查找、打开文件、读取文件属性，而不需要把整个镜像解压到另一个目录。

``` txt
EROFS 镜像 → mount → 像普通目录一样随机访问任意文件
```

EROFS 还可以选择对文件内容做透明压缩。压缩后的数据保留在镜像中，应用通过 `read()` 读取时，内核按需完成解压；应用本身不需要知道文件是否被压缩。与“把所有内容压成一个大压缩包”相比，EROFS 仍然保留了文件和目录的索引，可以定位到需要的文件和数据范围，避免为了读取一个小文件而解压整个镜像。对于很多小文件，尾部数据和元数据还可以采用内联布局，减少额外的磁盘访问。

因此，EROFS 的好处主要来自“不可变、直接访问、按需解压”这三个特性：

- **节省存储和传输空间。** 透明压缩、紧凑的元数据布局以及小文件内联，可以减小系统镜像或容器层的体积；在存储设备较慢时，减少需要读取的数据量也可能带来更好的端到端性能。
- **部署结果稳定且容易校验。** 镜像构建一次、到处挂载，内容可以保持 bit-for-bit 一致，适合版本发布、固件升级、容器分发和安全审计。运行时不能直接修改镜像，也减少了“某台机器被悄悄改过”的状态差异。
- **不需要完整解包，内存开销更可控。** 内核可以按路径和数据范围随机访问文件，只有真正读取到的压缩数据才需要解压，适合内存有限的嵌入式设备以及同时运行很多镜像的主机。
- **文件系统语义完整。** 权限、目录层次、符号链接、扩展属性等信息都由文件系统统一处理，程序仍然使用熟悉的 POSIX 文件接口，不需要针对某种归档格式改写。

当然，EROFS 的优势建立在“内容基本不变”这个前提上。它不适合直接承载需要频繁创建、删除和更新文件的工作负载；压缩也会引入一定的 CPU 解压开销，并不意味着所有访问都会比未压缩文件更快。对这类场景，应使用 ext4、XFS、Btrfs 等可写文件系统，或者将 EROFS 与 OverlayFS 组合使用。

所以，可以把 EROFS 理解成一种能够直接挂载、支持随机访问、带完整文件系统语义的“高级归档格式”：它看起来像归档文件一样适合发布固定内容，又像文件系统一样可以被内核直接访问。

## EROFS 的文件结构布局

EROFS 的 on-disk layout 可以先从一个全局视图理解。下面的图是逻辑示意，并不是说镜像一定只有一个连续的 Metadata 区和一个连续的 Data 区；实际布局会根据文件数量、inode 类型、xattr 和压缩方式，在多个位置交错放置元数据与数据。

``` txt
                              |-> aligned with the block size
  ____________________________________________________________
| |SB| | ... | Metadata | ... | Data | Metadata | ... | Data |
|_|__|_|_____|__________|_____|______|__________|_____|______|
0 +1K
```

和许多通用可写文件系统相比，EROFS 的布局更偏向“构建完成后只读访问”：它不需要为运行时更新预留复杂的日志、空闲空间管理和大量冗余元数据。格式越简单，镜像越容易生成、解析、校验和复现；同时，数据区域保持块对齐，也方便内核直接向块设备、内存映射区域或镜像后端发起读取。

### 1. Super Block：从镜像找到其他区域

镜像的前 1 KiB 保留不用，Super Block 从偏移 `1 KiB` 处开始。它不是普通文件的 inode，而是整个卷的入口，记录文件系统所需的全局信息，例如块大小、版本和特性标志，以及 inode 元数据、共享 xattr 等区域的起始块地址。内核挂载 EROFS 时，首先读取并检查 Super Block，随后才能根据这些地址解释后面的内容。

这里的“前 1 KiB 留空”让文件系统的关键描述信息拥有稳定的起始位置，也避免直接占用镜像的最前端空间。需要注意的是，Super Block 位于 `1 KiB` 并不代表所有内容都以 `1 KiB` 为单位排列；EROFS 的数据区域主要遵循文件系统 block size 对齐，元数据则可以采用更紧凑的布局。

### 2. inode 元数据空间：文件的索引和属性

EROFS 不会把所有 inode 紧跟在 Super Block 后面，也不会通过遍历链表来寻找某个文件的 inode。Super Block 会记录元数据区域的起始块地址，文件则使用 NID（numeric inode ID）作为自己的数字标识。借助这两个信息，内核可以直接计算 inode 的位置。

``` txt
                            |-> aligned with 8B
                                      |-> followed closely
+ meta_blkaddr blocks                                      |-> another slot
_____________________________________________________________________
|  ...   | inode |  xattrs  | extents  | data inline | ... | inode ...
|________|_______|(optional)|(optional)|__(optional)_|_____|__________
        |-> aligned with the inode slot size
              .                   .
            .                         .
          .                              .
        .                                    .
      .                                         .
    .                                              .
  .____________________________________________________|-> aligned with 4B
  | xattr_ibody_header | shared xattrs | inline xattrs |
  |____________________|_______________|_______________|
  |->    12 bytes    <-|->x * 4 bytes<-|               .
                      .                .                 .
                .                      .                   .
          .                           .                     .
      ._______________________________.______________________.
      | id | id | id | id |  ... | id | ent | ... | ent| ... |
      |____|____|____|____|______|____|_____|_____|____|_____|
                                      |-> aligned with 4B
                                                  |-> aligned with 4B
```

``` txt
struct erofs_super_block {
    ...
    __u8  blkszbits;       /* block size = 1 << blkszbits */
    ...
    __le32 meta_blkaddr;   /* metadata area 的起始块号 */
    ...
};
```

如果文件系统块大小为 `block_size`，那么 inode 元数据空间的起始地址就是：

``` txt
inode_metadata_space = block_size * meta_blkaddr
```

这里的 `meta_blkaddr` 是“块号”，不是字节偏移，因此必须先乘以文件系统块大小。`blkszbits` 保存的是块大小的以 2 为底的对数，例如 `blkszbits = 12` 时，`block_size = 1 << 12 = 4 KiB`。

### inode slot：用固定粒度定位 inode

EROFS 将 inode 元数据空间划分为连续的 inode slot。一个 slot 固定为 32 字节，它是 inode 定位和排列的最小粒度，而不是文件系统 block。这样，NID 到 inode 偏移之间就建立了简单的线性关系：

``` txt
inode_metadata_offset = inode_metadata_space + nid * 32
                       = block_size * meta_blkaddr + nid * 32
```

这套设计有两个好处：一方面，内核不需要扫描元数据区域来寻找 inode；另一方面，inode 可以紧凑地连续排列，减少只读镜像中的元数据占用。NID 越大，inode 在元数据空间中的位置就越靠后；具体 inode 是否有效以及采用哪一种布局，则由 inode 自身的格式字段进一步判断。

``` txt
metadata space
      +0              +32              +64              +96
      | inode slot 0  | inode slot 1   | inode slot 2   | ...
      |<--- 32 B  --->|<---- 32 B ---->|<---- 32 B ---->|
             ↑                ↑
            NID=0           NID=1
```

### compact inode 与 extended inode

EROFS 提供两种核心 inode 布局，用来在元数据占用和文件属性完整度之间取舍：

- **compact inode：** 核心部分为 32 字节，占用一个 inode slot，适合属性需求较简单、希望尽量缩小镜像元数据的场景。
- **extended inode：** 核心部分为 64 字节，占用连续的两个 inode slot，可以保存更完整的文件属性，例如更大的 UID/GID 范围、更大的文件大小范围和纳秒级时间戳。

两种 inode 共享一部分字段，其中的 `i_format` 用于标识 inode 类型和数据格式。内核先根据 NID 定位到 inode，再读取 `i_format`，由此确定当前 inode 的长度以及后续属性应如何解析。也就是说，32 字节 slot 负责提供统一的寻址粒度，而不意味着每一个 inode 的实际大小都固定为 32 字节。

``` txt
compact inode                    extended inode
|<---------- 32 B ---------->|   |<------------- 64 B ------------->|
|       one inode slot       |   |        two consecutive slots     |
```

inode 的核心字段主要描述文件本身：文件类型、权限、大小、链接数、所有者以及时间信息等。文件名不保存在 inode 中，而是由父目录的目录项将名称映射到对应的 NID；因此，路径查找完成后，内核才能根据 NID 计算并读取目标 inode。

在 inode 核心部分之后，镜像还可能紧跟当前 inode 所需的附加元数据。它们属于该 inode 的扩展区域，是否存在以及长度是多少，由 inode 的字段和格式共同决定：

``` txt
| inode core | optional inode metadata | next inode ... |
| 32/64 B    | xattr / extent / inline |                |
```

因此，EROFS 的 inode 元数据空间可以概括为一套“固定粒度寻址、可变长度解析”的布局：先用 `meta_blkaddr` 找到元数据空间，用 `NID × 32 B` 找到 inode 起点；再根据 `i_format` 判断是 compact 还是 extended inode，并按照对应格式读取文件属性及其附加信息。它既保持了只读镜像所需要的紧凑性，也让内核能够快速、确定地定位任意文件。

### inode xattrs：扩展属性的存储方式

xattr（extended attribute，扩展属性）是附着在 inode 上的键值对元数据。它不是普通文件内容，也不属于文件名、权限这些 inode 核心字段，而是用来承载更灵活的文件属性，例如 `security.*` 安全标签、POSIX ACL，以及 OverlayFS 使用的 `trusted.overlay.*` 属性。

EROFS 的 xattr 设计主要考虑两个问题：有些属性只属于一个文件，适合紧跟在 inode 后面保存；另一些属性会被大量文件重复使用，如果每个 inode 都完整复制一份，就会浪费镜像空间。因此，EROFS 同时支持两种形式：

- **inline xattr：** 保存在当前 inode 后面的扩展区域中，适合数量少、只被当前文件使用的属性。
- **shared xattr：** 属性内容集中存放在共享 xattr 区域，inode 只保存 4 字节的 ID 引用，适合多个文件拥有相同名称和值的属性。

下面是 EROFS 官方布局图的原始版本，先保留它作为整体视图：

``` txt
_____________________________________________________|-> aligned with 4B
| xattr_ibody_header | shared xattrs | inline xattrs |
|____________________|_______________|_______________|
|->    12 bytes    <-|->x * 4 bytes<-|
```

``` c
/*
 * inline xattrs (n == i_xattr_icount):
 * erofs_xattr_ibody_header(1) + (n - 1) * 4 bytes
 *          12 bytes           /                   \
 *                            /                     \
 *                           /-----------------------\
 *                           |  erofs_xattr_entries+ |
 *                           +-----------------------+
 * inline xattrs must starts in erofs_xattr_ibody_header,
 * for read-only fs, no need to introduce h_refcount
 */
struct erofs_xattr_ibody_header {
  __le32 h_name_filter;  /* bit value 1 indicates not-present */
  __u8   h_shared_count;
  __u8   h_reserved2[7];
  __le32 h_shared_xattrs[];       /* shared xattr id array */
};
```

#### inline xattr 的布局

inline xattr 区域紧跟在 inode 核心结构之后，并从 4 字节对齐的位置开始。它由三部分组成：固定大小的 `erofs_xattr_ibody_header`、共享 xattr ID 数组，以及当前 inode 自己保存的 inline xattr entry。

``` txt
inode core
    |
    | 4 字节对齐
    v
+-------------------------------+
| erofs_xattr_ibody_header      | 12 B
+-------------------------------+
| shared xattr ID 0             | 4 B
| shared xattr ID 1             | 4 B
| ...                           |
+-------------------------------+
| inline xattr entry 0          |
| inline xattr entry 1          |
| ...                           |
+-------------------------------+
```

`h_shared_count` 表示当前 inode 引用了多少个 shared xattr；每个引用占 4 字节，存放在 `h_shared_xattrs[]` 中。共享引用数组结束后，剩余空间才用于保存 inline entry。`h_name_filter` 是用于快速判断属性名称是否可能存在的过滤字段，可以在真正遍历 entry 之前排除一部分“不可能命中”的查询。

inline xattr 区域的大小由 inode 中的 `i_xattr_icount` 间接决定：

``` txt
xattr_ibody_size
    = sizeof(erofs_xattr_ibody_header)
    + (i_xattr_icount - 1) * 4
    = 12 + (i_xattr_icount - 1) * 4 bytes
```

这里的 `i_xattr_icount` 不是“属性条目数量”的简单等价物，而是用来描述 inline xattr body 所需的 4 字节计数单位。内核先根据它确定 inline 区域边界，再依据 `h_shared_count` 区分其中哪些是 shared ID、哪些是 inline entry。没有 xattr 时，`i_xattr_icount` 为 0，inode 后面就没有对应的 xattr body。

#### xattr entry：名称和值如何排列

inline xattr 和 shared xattr 最终都使用相同的 entry 格式。entry 的固定头部只有 4 字节，后面依次是属性名称和属性值：

``` txt
erofs_xattr_entry
+----------------+------------------+--------------------+
| e_name_len     | e_name_index     | e_value_size       |
| 1 byte         | 1 byte           | 2 bytes            |
+----------------+------------------+--------------------+
| name bytes ...                    |
+-----------------------------------+
| value bytes ...                   |
+-----------------------------------+
| padding，补齐到 4 字节             |
+-----------------------------------+
```

- `e_name_len` 记录名称长度；
- `e_name_index` 表示属性所属的命名空间，例如 `user`、`trusted`、`security` 或 POSIX ACL；
- `e_value_size` 记录属性值长度；
- entry 总长度会向上按 4 字节对齐，所以下一个 entry 不一定紧跟在 value 的最后一个字节之后。

EROFS 没有把完整的 `security.`、`trusted.` 等前缀重复写进每一个 entry，而是通过 `e_name_index` 表示短前缀，再保存实际名称部分。这样可以进一步减少属性名称占用的空间。较新的格式还支持长 xattr 名称前缀，将公共前缀放入前缀表，entry 中只保存剩余部分。

#### shared xattr 的布局

shared xattr 的索引位于 inode 内部，但属性实体位于由 Super Block 中 `xattr_blkaddr` 指定的共享区域。每个 shared xattr 按 4 字节对齐连续排列，inode 中的 ID 可以直接计算出对应 entry 的位置：

``` txt
xattr offset = xattr_blkaddr * block_size + 4 * xattr_id

                       |-> aligned by  4 bytes
+ xattr_blkaddr blocks                     |-> aligned with 4 bytes
  ______________________________________________________________________
|  ...   | xattr_entry | xattr data  | ... | xattr_entry  | xattr data...
|________|_____________|_____________|_____|______________|_____________
```

这里的 `xattr_id` 不是字节偏移，而是以 4 字节为单位的 entry 起始索引；因此，计算共享属性的物理位置时需要先乘以 `4`。共享区域中的 entry 和 inline xattr 使用相同的 `erofs_xattr_entry` 格式，entry 内部再保存属性名称和值。

``` txt
shared xattr space
      +0              +4              +8
      | xattr entry 0 | xattr entry 1 | xattr entry 2 | ...
      |<-- entry 0 -->|

xattr_offset = xattr_blkaddr * block_size + 4 * xattr_id
```

把 inode 中的引用和共享区域联系起来，可以得到完整关系：

``` txt
inode
  |
  +-- h_shared_xattrs[0] = xattr_id
                              |
                              v
shared xattr space  -- xattr_blkaddr * block_size + 4 * xattr_id
                              |
                              v
                     xattr_entry -> name -> value
```

这种方式类似“索引 + 共享对象”：inode 只承担定位职责，属性名称和值只保存一份。对于系统镜像和容器镜像中大量重复的安全标签、OverlayFS 属性或 ACL，可以明显减少元数据冗余。由于 EROFS 是只读文件系统，镜像构建完成后不会发生运行时引用计数更新，所以 inline xattr header 不需要像可写文件系统那样维护 `h_refcount`。

#### 内核读取一个 xattr 的过程

当用户通过 `getxattr()` 查询某个属性时，内核大致按以下顺序读取：

``` txt
读取 inode 的 i_xattr_icount
              |
              v
定位 inode 后的 xattr_ibody_header
              |
              +-- 读取 h_name_filter，快速排除不可能的名称
              |
              +-- 读取 h_shared_count 个 shared xattr ID
              |
              +-- 遍历 inline xattr entry
              |
              +-- 若未命中，按 xattr_id 到 shared xattr 区域查找
              v
匹配 namespace + name，返回 value
```

因此，EROFS 的 xattr 不是一个脱离 inode 的独立表，而是“inode 内部保存少量索引和局部属性，公共属性放到共享区域”的组合。它在保留 Linux 文件系统扩展属性语义的同时，把只读镜像中最重要的两个目标结合起来：单个文件的属性可以直接访问，重复属性又不会被大量复制。

### Dir：目录布局

目录是路径查找的入口。文件名并不保存在 inode 中，而是保存在父目录的数据块中；目录项再把“文件名”映射到目标文件的 NID。内核拿到 NID 后，才能回到 inode 元数据空间定位目标 inode，并继续读取文件属性和数据。

EROFS 将目录块组织成两个连续的区域：前半部分是定长的 `dirent` 索引区，后半部分是变长的文件名区域。索引区不保存完整文件名，而是保存 NID、文件类型和文件名在当前目录块中的偏移；这样可以让目录项大小保持固定，也能避免为不同长度的文件名预留固定空间。

``` txt
                  ___________________________
                 /                           |
                /              ______________|________________
               /              /              | nameoff1       | nameoffN-1
  ____________.______________._______________v________________v__________
 | dirent | dirent | ... | dirent | filename | filename | ... | filename |
 |___.0___|____1___|_____|___N-1__|____0_____|____1_____|_____|___N-1____|
      \                           ^
       \                          |                           * could have
        \                         |                             trailing '\0'
         \________________________| nameoff0
                              Directory block
```

#### dirent 索引区

一个目录项对应一个 `struct erofs_dirent`，当前格式的大小为 12 字节：

``` c
struct erofs_dirent {
    __le64 nid;       /* 目标文件或目录的 NID */
    __le16 nameoff;   /* 文件名在 name 区域中的偏移 */
    __u8   file_type; /* 文件类型 */
    __u8   reserved;
};
```

可以把 `dirent` 看成目录中的“索引记录”：

``` txt
+----------------------+----------------------+------------------+
| nid                  | nameoff              | file_type        |
| 找到哪个 inode       | 文件名从哪里开始     | 普通文件/目录/... |
+----------------------+----------------------+------------------+
```

- `nid` 是目标 inode 的数字标识。它不是当前目录块内的序号，而是可以用于定位整个 EROFS 镜像中 inode 的全局 ID。
- `nameoff` 是相对于当前目录块起始位置的偏移，指向后面的文件名区域。不同文件名长度不会改变 `dirent` 本身的大小。
- `file_type` 保存目录项对应的文件类型，例如普通文件、目录、符号链接或设备文件。内核可以先从目录项得到类型，避免某些场景下必须立即读取目标 inode。
- `reserved` 为未来扩展保留，当前不承载有效的目录信息。

#### 文件名区域和 `nameoff`

文件名区域紧跟在所有 `dirent` 之后。多个文件名连续存放，`nameoff` 分别指向它们的起始位置：

``` txt
目录块起始地址
       |
       v
| dirent 0 | dirent 1 | dirent 2 | ... | dirent N-1 |
|<--------- 固定长度索引区 ----------->|
                                             |
                                             v
| filename 0 | filename 1 | filename 2 | ... | filename N-1 |
      ^             ^
      |             |
   nameoff0      nameoff1
```

`nameoff0` 指向第一个文件名，同时也隐含了索引区的边界：因为每个 `dirent` 都是固定的 12 字节，所以可以根据第一个文件名的偏移计算目录项数量：

``` txt
dirent_count = nameoff0 / sizeof(struct erofs_dirent)
              = nameoff0 / 12
```

这样，目录块不需要额外保存一个“目录项数量”字段。图中的文件名末尾可以带 `\0`，也可以通过下一个文件名的偏移或目录块边界判断当前名称的长度；原图中标注的 `trailing '\0'` 表示这一点。

#### 为什么目录项必须按字典序排列

EROFS 是只读文件系统，目录在镜像构建阶段就已经确定，因此可以要求同一个目录块中的目录项按文件名字典序排列。内核查找名称时不必从第一个 entry 逐个线性扫描，而是可以利用排序关系进行二分查找：

``` txt
目标名称："hosts"

alpha ...       etc ...        hosts ...        usr ...        zsh ...
    \              |              |               /
     \-------------+--------------+--------------/
                    ↓
          比较中间文件名，缩小查找范围
                    ↓
              命中 nameoff
                    ↓
               读取对应 NID
```

这里的“按字典序”是目录项的 on-disk 排列规则，不是把文件名编码成固定长度。文件名仍然是变长字符串，只是 `dirent` 索引记录通过 `nameoff` 找到对应字符串。排序带来的价值是减少目录查找需要读取和比较的 entry 数量，尤其适合包含大量文件的只读镜像。

#### 从路径到 inode 的查找过程

以查找 `/etc/hosts` 为例，内核需要逐级处理目录：

``` txt
根目录 inode
    |
    +-- 读取根目录数据块
    +-- 在 dirent 中二分查找 "etc"
    +-- 通过 nameoff 比较文件名
    +-- 得到 "etc" 的 NID
    v
读取 etc 目录 inode
    |
    +-- 读取 etc 目录数据块
    +-- 在 dirent 中二分查找 "hosts"
    +-- 通过 nameoff 比较文件名
    +-- 得到 "hosts" 的 NID
    v
根据 hosts 的 NID 定位 inode
    |
    +-- 读取文件属性
    +-- 根据数据布局读取文件内容
```

可以看到，目录项只负责完成“名称 → NID”的映射，不直接保存目标文件的完整属性，也不直接保存文件内容。路径查找、inode 解析和数据读取由三个相互衔接但职责清晰的步骤完成：

``` txt
文件名
  ↓ 目录 dirent + nameoff
NID
  ↓ inode 元数据空间
inode 属性和数据布局
  ↓ extent / inline data / 压缩索引
文件内容
```

这种布局特别适合 EROFS 的只读场景：目录项可以在构建镜像时排序，运行时只读地使用索引；固定大小的 `dirent` 便于解析，变长文件名又不会造成大量空间浪费；最终通过 NID 直接跳转到 inode，避免了像普通归档格式那样扫描整个目录或解包整个文件树。

## data inline：把文件尾部放入元数据空间

这里的 data inline 指的是：把文件的一部分内容直接放到 inode 元数据附近，而不是为这部分内容单独分配一个完整的数据块。它保存的是文件的真实 payload，不是 inode 属性，也不是 xattr；因此不要把 data inline 和 inline xattr 混为一谈。

EROFS 中最典型的是 flat file 的 tail packing。文件仍然可以拥有位于数据区的完整 block，但文件最后不足一个 block 的尾部数据，会被紧跟在 inode 元数据之后保存。对于足够小的文件，如果整个内容都能放进这段尾部空间，那么文件甚至不需要单独的数据 block。

``` txt
普通文件：每个数据范围都放在数据 block 中

inode  ── startblk / extent ──>  data block 0  ──>  data block 1  ──> ...
                                |<---------- block_size ---------->|

EROFS flat inline：完整 block 正常存放，最后的不足一块的部分内联

inode metadata  ── startblk / extent ──>  data block 0  ──> ...
       |
       +── inline tail：文件最后的 tail 数据
```

### 为什么需要 data inline

EROFS 的镜像通常包含大量小文件，例如配置文件、启动脚本、证书、清单和应用资源。如果一个只有几十或几百字节的文件也必须独占一个 4 KiB 数据 block，那么真正有用的数据只占很小一部分，其余空间都是内部碎片：

``` txt
不使用 data inline，假设 block_size = 4 KiB

|--------- 一个完整数据 block ---------|
|       100 B 文件内容       | 约 3996 B 空闲 |

使用 data inline

| inode metadata | 100 B inline data |
|    已有空间     |   只保存实际内容   |
```

把尾部数据放到元数据区域可以带来两个直接收益：

- **减少空间浪费。** 小文件不必因为几百字节内容而占用一个完整 block；大量小文件组成的系统镜像可以因此明显变得更紧凑。
- **减少额外 I/O。** 读取 inode 时，内核通常已经需要访问 inode 元数据；如果文件内容也位于 inode 后面，就可以在同一段元数据读取中取得文件内容，避免再读取一个只包含少量数据的 block。这就是 EROFS 文档所说的减少 I/O amplification。

### EROFS 如何表示 data inline

inode 的 `i_format` 数据布局字段用于区分普通 flat file 和带 tail packing 的 flat file。`EROFS_INODE_FLAT_INLINE` 的值为 `2`：

``` c
enum {
    EROFS_INODE_FLAT_PLAIN       = 0, /* 普通未压缩文件 */
    EROFS_INODE_COMPRESSED_FULL  = 1, /* 压缩文件 */
    EROFS_INODE_FLAT_INLINE      = 2, /* 带 tail packing 的未压缩文件 */
    /* ... */
};
```

对于 flat inline inode，inode 中的起始 block 信息仍然用于定位文件前面的完整数据 block；inline 部分则由文件大小和 inode 元数据布局共同确定。设文件大小为 `i_size`，文件系统 block 大小为 `block_size`，则最后一个不完整 block 的长度可以表示为：

``` txt
tail_size = i_size % block_size
```

读取时可以将文件分成两部分理解：

``` txt
文件逻辑空间
|<------------- full blocks ------------->|<- tail_size ->|
|              数据区中的 block            | inode 后的内联数据 |
0                                          i_size
```

例如，`block_size = 4096`、文件大小为 `5000` 字节时：

``` txt
文件内容：
|<---------------- 4096 B ---------------->|<--- 904 B --->|
|          数据区中的完整 block            |   inline tail  |
```

如果文件大小为 `100` 字节，则没有完整数据 block，整个文件内容都可以作为 inline tail 保存：

``` txt
| inode core | xattr / 其他 inode metadata | 100 B file data |
                                             ^
                                             |
                                      文件内容从这里开始
```

当 `i_size` 恰好是 `block_size` 的整数倍时，`tail_size` 为 0，文件不需要额外的 inline tail；这时它和普通的未压缩 flat file 一样，完整内容位于数据 block 中。

### inode 后面的实际布局

data inline 并不是塞进 inode 核心结构的固定字段里，而是放在 inode 及其可选元数据之后。前面的 xattr、其他 inode 扩展信息和对齐填充会影响 inline data 的起始位置，因此不能简单地认为它永远从 inode 的固定偏移开始：

``` txt
inode metadata space

| inode core | inline xattr / shared xattr ID | 对齐 | inline tail |
|  32/64 B   |          optional              |      | file data   |
                                                   |
                                                   +-- 文件最后的 tail
```

在镜像构建时，`mkfs.erofs` 会计算 inode、xattr 和 inline tail 的总长度，并检查这段元数据布局是否满足对齐和物理 block 边界要求。如果 inline tail 无法放入允许的位置，例如会导致 inode 相关数据跨越不允许的物理 block 边界，构建工具就不能使用这种布局，需要选择普通 flat file 或其他数据布局。

### 一次读取如何使用 inline data

应用层不需要知道文件是否使用了 data inline。应用仍然通过普通的 `read()` 或 `mmap()` 访问文件，内核根据 inode 的数据布局完成映射：

``` txt
open("small.conf")
        |
        v
读取 inode，发现 i_format = FLAT_INLINE
        |
        +-- 读取前面的完整 block（如果存在）
        |
        +-- 根据 i_size 计算 tail_size
        |
        +-- 从 inode 元数据之后读取 inline tail
        v
向用户空间返回连续的文件内容
```

对用户来说，完整文件仍然表现为从偏移 0 开始的连续字节流；inline 只是文件系统在物理布局上的优化。内核需要把“数据 block 中的前半部分”和“inode 后的 tail”拼接成统一的逻辑文件空间，用户程序不需要为此改变读取方式。

### data inline 的边界

data inline 并不是“所有文件都应该内联”，它更适合小文件或只剩少量尾部数据的文件。对于大型文件，如果把很长的尾部放到 inode 元数据区域，会增加元数据读取和管理成本，失去块对齐带来的优势；因此 EROFS 通常只内联最后不足一个 block 的部分，并让前面的完整 block 保持常规的数据区布局。

本节讨论的是未压缩 flat file 的 tail packing，也就是 `EROFS_INODE_FLAT_INLINE`。压缩文件还存在 `ztailpacking` 等相关机制：它内联的是压缩后的尾部数据，索引和读取路径更复杂，应该结合 EROFS 的压缩布局单独分析。

## inline/shared xattr：两种扩展属性布局

前面分别介绍了 inline xattr 和 shared xattr。这里把两者放在一起看：它们不是互斥的两种文件系统，而是同一个 inode 可以同时使用的两种存储方式。EROFS 通过“本地属性直接保存，共享属性只保存引用”的组合，在访问速度和镜像体积之间取得平衡。

扩展属性本质上是附着在文件或目录上的名称和值，例如：

``` txt
security.ima       ->  签名或完整性校验信息
security.selinux   ->  SELinux 安全上下文
trusted.overlay.*  ->  OverlayFS 元数据
system.posix_acl_* ->  POSIX ACL
```

### inline 与 shared 如何选择

两种布局的核心区别不是属性的语义，而是属性实体保存在哪里：

| 布局 | inode 中保存的内容 | 适合的属性 | 主要特点 |
| --- | --- | --- | --- |
| inline xattr | 完整的 entry、名称和 value | 只属于单个文件，或体积较小的属性 | 访问路径短，不需要额外跳转 |
| shared xattr | 4 字节 xattr ID | 多个文件拥有相同名称和值的属性 | 内容只保存一份，节省镜像空间 |

例如，某个文件独有的 `security.ima` 签名更适合 inline；如果镜像中有大量文件都拥有完全相同的某个 OverlayFS 属性，那么把属性实体放到 shared xattr 区域，再由多个 inode 引用，会比重复保存完整名称和值更紧凑。

``` txt
                         一个 inode 的 xattr 视图

                 +-----------------------------+
                 | xattr_ibody_header          |
                 +-----------------------------+
                 | shared xattr ID array        |----+
                 +-----------------------------+    |
                 | inline xattr entry           |    |
                 | inline xattr entry           |    |
                 +-----------------------------+    |
                                                     v
                                      +-----------------------------+
                                      | shared xattr entry/value    |
                                      +-----------------------------+
```

### 一个 inode 如何同时保存两类 xattr

inline/shared xattr 的共同入口是 inode 后面的 `erofs_xattr_ibody_header`。这个 header 固定为 12 字节，后面首先是 `h_shared_count` 个 4 字节的 shared xattr ID，剩余空间才用于保存当前 inode 的 inline xattr entry：

``` txt
inode core
    |
    | 4 字节对齐
    v
+-------------------------------+
| erofs_xattr_ibody_header      | 12 bytes
|   h_name_filter               |
|   h_shared_count              |
|   h_reserved2                 |
+-------------------------------+
| h_shared_xattrs[0]            | 4 bytes
| h_shared_xattrs[1]            | 4 bytes
| ...                           |
+-------------------------------+
| inline xattr entry 0          |
| inline xattr entry 1          |
| ...                           |
+-------------------------------+
```

因此，`h_shared_count` 只表示 shared 引用的数量，不表示所有 xattr 的数量。内核需要先跳过 header 和 shared ID 数组，才能开始解析 inline entry。当 `i_xattr_icount > 0` 时，整个 xattr body 的边界由 inode 中的 `i_xattr_icount` 确定：

``` txt
xattr_ibody_size
    = 12 + (i_xattr_icount - 1) * 4 bytes
```

如果当前 inode 没有 xattr，`i_xattr_icount` 为 0；如果只有 shared xattr，那么 xattr body 可能只有 header 和 shared ID 数组，不一定存在 inline entry；如果同时存在两类属性，则两者在同一个 inode xattr body 中共存。

### shared xattr 如何指向属性实体

shared xattr 的完整名称和值不放在 inode 中，而是存放在由 `xattr_blkaddr` 定位的共享区域。inode 中的 `h_shared_xattrs[]` 数组只保存 ID，内核通过下面的公式找到对应 entry：

``` txt
xattr_offset = xattr_blkaddr * block_size + 4 * xattr_id
```

``` txt
inode A                         inode B
    |                                |
    | h_shared_xattrs[0] = 12        | h_shared_xattrs[0] = 12
    |                                |
    +----------------+---------------+
                     v
        shared xattr space
        +---------------------------+
        | ... | xattr_id = 12       |
        |     | name + value        |
        +---------------------------+
```

这里的共享是“属性名称和值相同”时的共享。不同 inode 可以引用同一个 shared entry，但仍然可以拥有自己的 inline xattr；共享的是属性实体，而不是 inode，也不是文件内容。

### 内核读取 xattr 的顺序

当用户通过 `getxattr()` 查询某个名称时，内核需要把 inline 和 shared 两部分视为同一个逻辑属性集合：

``` txt
读取 inode
    |
    v
读取 i_xattr_icount，定位 xattr body
    |
    +-- 读取 h_name_filter
    |
    +-- 读取 h_shared_count 个 shared xattr ID
    |
    +-- 扫描 inline xattr entry
    |       |
    |       +-- 命中：返回 value
    |
    +-- 未命中：根据 shared xattr ID 扫描共享 entry
            |
            +-- 命中：返回 value
            +-- 未命中：返回属性不存在
```

`h_name_filter` 可以在遍历完整 entry 之前快速排除一部分不可能存在的属性名称；它只是一种查找优化，最终结果仍然需要通过 namespace、名称和 value 长度等字段确认。inline 和 shared entry 使用相同的 `erofs_xattr_entry` 格式，因此读取逻辑可以复用同一套名称和值解析代码。

### 为什么不把所有 xattr 都放到 shared 区域

如果所有属性都统一放在共享区域，inode 每次读取属性都要进行额外跳转；而且只被单个文件使用的属性并不能从共享中获益，反而多了一层索引。相反，如果所有属性都 inline 保存，重复的名称和值会在镜像中大量复制。

EROFS 的组合方案可以概括为：

``` txt
小而独有的属性       -> inline，直接跟随 inode
大而重复的属性       -> shared，inode 保存 ID
同一个 inode          -> 可以同时使用 inline + shared
```

这正是只读镜像适合使用 inline/shared xattr 的原因：镜像构建阶段已经知道哪些属性会重复，可以提前进行共享；运行阶段不需要修改属性，也不需要维护可写文件系统常见的引用计数和更新日志。最终，xattr 仍然通过 Linux 标准接口对外提供，但 on-disk 格式更紧凑、更适合批量分发和只读访问。

## i_format：EROFS 的五种 inode 数据布局

前面已经看到，inode 的核心字段只描述文件的基本属性，还需要知道“文件内容究竟存在哪里、应该如何读取”。这个信息由 inode 中的 `i_format` 提供。它不是单纯的版本号，而是一个格式提示字段：其中一部分用于区分 compact/extended inode，另一部分用于选择文件数据的组织方式。

从概念上可以把它理解成：

``` txt
i_format
   |
   +-- inode layout：compact inode / extended inode
   |
   +-- data layout：文件内容如何存放和读取
                    |
                    +-- 0  普通未压缩 flat file
                    +-- 1  压缩文件，完整索引
                    +-- 2  未压缩文件，尾部 data inline
                    +-- 3  压缩文件，紧凑索引
                    +-- 4  chunk-based file
```

在当前 on-disk 格式中，数据布局使用 `i_format` 的 bit 1～3 表示，取值 5～7 预留给未来扩展。内核读取 inode 后，先解析 `i_format`，再根据对应的数据布局解释 `i_u`、extent 或压缩索引；同一个字段在不同布局下可能具有不同含义。

``` c
/* 简化表示，实际还需要结合版本和其他标志解析 */
inode_layout = i_format & 0x1;
data_layout  = (i_format >> 1) & 0x7;
```

### 五种数据布局总览

| 值 | 内核名称 | 数据组织方式 | 主要用途 |
| --- | --- | --- | --- |
| 0 | `EROFS_INODE_FLAT_PLAIN` | 未压缩，文件内容位于连续数据 block | 普通顺序读取、直接访问 |
| 1 | `EROFS_INODE_COMPRESSED_FULL` | 压缩数据 + 非紧凑/完整索引 | 需要透明压缩和较完整索引能力的文件 |
| 2 | `EROFS_INODE_FLAT_INLINE` | 未压缩，最后不足一个 block 的尾部内联 | 小文件和尾部较短的文件 |
| 3 | `EROFS_INODE_COMPRESSED_COMPACT` | 压缩数据 + 紧凑索引 | 在压缩和元数据体积之间取得平衡 |
| 4 | `EROFS_INODE_CHUNK_BASED` | 文件切分为等大小 chunk，通过 chunk 索引定位 | chunk 去重、多设备或数据共享场景 |

``` txt
                 inode
                   |
                   | 读取 i_format
                   v
        +----------+----------+----------+----------+----------+
        |          |          |          |          |          |
      0 plain    1 compr.   2 inline   3 compr.   4 chunk
                 full                  compact
        |          |          |          |          |
      blocks    压缩索引    tail      压缩索引    chunk index
                            data
```

下面分别看这五种布局如何解释文件内容。

### 0：普通未压缩 flat file

`EROFS_INODE_FLAT_PLAIN` 是最直接的布局。inode 中的 `i_u` 字段保存文件数据的起始 block，文件内容从这个 block 开始连续排列：

``` txt
inode.i_u.startblk
        |
        v
| data block 0 | data block 1 | data block 2 | ... |
|<------------------ 文件内容 --------------------->|
```

如果文件大小为 `i_size`，需要的数据 block 数量大致是：

``` txt
data_blocks = ceil(i_size / block_size)
```

这种布局没有压缩索引，也没有 data inline；优点是读取路径简单，已知文件偏移后可以直接计算对应的数据 block。对于不适合压缩、需要直接 I/O 或希望减少解压开销的文件，普通 flat layout 是自然选择。

### 1：压缩文件与完整索引

`EROFS_INODE_COMPRESSED_FULL` 表示文件内容经过透明压缩，inode 后面或相关元数据区域保存压缩映射索引。索引把文件的逻辑范围映射到压缩数据所在的 physical cluster：

``` txt
文件逻辑空间
| logical cluster 0 | logical cluster 1 | logical cluster 2 |
          |                  |                  |
          +------------------+------------------+
                           压缩索引
                                  |
                                  v
镜像物理空间
| compressed pcluster 0 | compressed pcluster 1 | ... |
```

“完整索引”可以保存更完整的映射信息，代价是索引本身占用更多元数据空间。读取文件中间的一段内容时，内核先通过索引找到对应的压缩 cluster，再读取和解压所需范围，而不需要解压整个文件。

### 2：未压缩文件与 data inline

`EROFS_INODE_FLAT_INLINE` 是前面介绍的 tail packing 布局。文件前面的完整 block 位于普通数据区，最后不足一个 block 的部分直接放在 inode 元数据之后：

``` txt
| inode + xattrs + metadata | inline tail |
                              +-- 文件尾部

| data block 0 | data block 1 | ... |
```

对于足够小的文件，整个文件都可以放进 inline tail，不再单独分配数据 block。此布局主要减少小文件造成的内部碎片和额外 I/O；它不表示文件经过压缩，文件内容仍然是原始的未压缩字节。

### 3：压缩文件与紧凑索引

`EROFS_INODE_COMPRESSED_COMPACT` 同样使用透明压缩，但采用更紧凑的压缩索引表示。它的重点是减少索引元数据本身的占用，适合镜像中存在大量压缩文件、需要控制 metadata 体积的场景：

``` txt
完整索引布局：
| full index 0 | full index 1 | full index 2 | ... |

紧凑索引布局：
| compact index 0 | compact index 1 | compact index 2 | ... |
```

两种压缩布局对应用层都是透明的，应用仍然只看到解压后的普通文件。区别主要发生在镜像构建和内核读取压缩映射时：完整索引保留更多直接定位信息，紧凑索引则用更少的元数据表达相同的逻辑到物理映射。具体使用哪种布局由镜像构建工具根据压缩配置、文件规模和索引优化策略决定。

### 4：chunk-based file

`EROFS_INODE_CHUNK_BASED` 将文件切分成大小相等的 chunk，inode 的 extents 区域不再表示传统的连续 extent，而是保存每个 chunk 的位置或索引：

``` txt
文件逻辑空间
| chunk 0 | chunk 1 | chunk 2 | chunk 3 | ... |
     |         |         |         |
     v         v         v         v
| block A | block C | block A | device B |
```

相同内容的 chunk 可以被不同文件引用，这为 chunk-based deduplication 提供了基础；chunk index 还可以携带后端设备信息，使文件数据能够分布在多个设备或外部 blob 中。当前 EROFS 格式中，chunk-based file 主要用于未压缩的数据，不能简单等同于压缩布局。

### 内核如何根据 i_format 读取文件

五种布局的共同点是：用户空间不需要知道文件采用了哪一种格式。内核在打开和读取文件时，根据 `i_format` 选择对应的 address space 和数据映射逻辑：

``` txt
读取 inode
    |
    v
解析 i_format
    |
    +-- FLAT_PLAIN       -> 计算连续数据 block
    |
    +-- COMPRESSED_FULL  -> 读取完整压缩索引，再解压 pcluster
    |
    +-- FLAT_INLINE      -> 读取数据 block，并拼接 inode 后的 tail
    |
    +-- COMPRESSED_COMPACT
    |                      -> 读取紧凑索引，再解压 pcluster
    |
    +-- CHUNK_BASED      -> 通过 chunk index 定位每个 chunk
    v
返回统一的文件字节流
```

这也是 `i_format` 存在的意义：同一个 inode 接口可以承载不同的物理布局，读取路径则由格式字段选择。EROFS 不需要为每一种布局创建不同的文件系统接口，只需要在 inode 和数据映射层解释相应的索引。

### 如何理解这五种布局的取舍

可以用三个问题快速判断某种布局的设计目标：

``` txt
是否需要压缩？
    ├─ 否 -> 是否适合 tail packing？ -> FLAT_PLAIN / FLAT_INLINE
    └─ 是 -> 更看重索引完整度还是元数据体积？
                                      └─ FULL / COMPACT

是否需要等大小切分、去重或多设备引用？
    └─ 是 -> CHUNK_BASED
```

因此，EROFS 的“五种 format”不是五种互不相关的文件系统，而是针对不同文件内容和镜像构建目标的五种 inode 数据表示。它们共同服务于同一个目标：在保持 Linux 文件系统语义的同时，让不可变镜像可以根据文件特征选择更紧凑、更容易随机访问的物理布局。

## 总结：从只读镜像到直接访问

EROFS 可以被理解为一种面向不可变镜像的文件系统：镜像在构建阶段生成，运行阶段主要负责查找和读取。它没有把镜像当成一个必须先完整解包的压缩文件，而是把文件系统需要的索引、属性和数据布局直接组织在镜像中，让 Linux 内核可以通过标准文件接口访问其中的任意文件。

整篇文章的核心关系可以概括为：

``` txt
Super Block
    |
    +-- 找到 metadata / xattr 等区域
    v
inode metadata
    |
    +-- NID 直接定位 inode
    +-- inode 保存属性和 i_format
    v
目录 dirent
    |
    +-- 文件名通过 nameoff 找到
    +-- 文件名映射到目标 NID
    v
目标 inode
    |
    +-- inline/shared xattr 提供扩展属性
    +-- i_format 决定文件数据如何组织
    v
文件内容
    |
    +-- 普通数据 block
    +-- data inline
    +-- 压缩数据和压缩索引
    +-- chunk-based 数据
```

从这些布局可以看到，EROFS 的设计始终围绕三个目标展开：

- **直接访问。** 目录项、NID 和 inode 让内核能够从路径逐级定位到文件，不需要扫描或解包整个镜像。
- **紧凑存储。** inline/shared xattr、data inline、压缩和 chunk 化布局共同减少元数据、重复属性以及小文件带来的空间浪费。
- **稳定读取。** 镜像构建完成后保持不可变，目录可以预先排序，索引可以预先生成，运行时只需要按照 `i_format` 选择对应的读取路径。

需要特别强调的是，EROFS 的压缩并不是一个可以简单附加在普通文件系统上的小功能，而是它的核心重点之一。压缩会直接影响文件的物理布局、inode 后的索引、逻辑数据到物理数据的映射，以及内核如何在随机读取时定位、读取和解压数据。EROFS 的空间节省、镜像分发效率和读取性能，很大程度上都取决于压缩格式与读取路径之间的配合。

本文暂时只建立压缩相关的整体位置：压缩文件属于 `i_format` 的第 1 和第 3 种数据布局，并通过压缩索引连接逻辑文件空间和 physical cluster。后续文章将专门讲解 EROFS 的压缩实现，包括：

- fixed-sized output compression 为什么适合随机访问；
- logical cluster、physical cluster、HEAD 和 NONHEAD 的关系；
- 压缩索引如何把文件偏移映射到压缩数据；
- 内核读取压缩文件时的查找、I/O、解压和缓存路径；
- 完整索引、紧凑索引、big pcluster、tail packing 以及压缩数据去重之间的关系。

理解这些内容之后，才能真正看清 EROFS 为什么不仅是“一个带压缩的只读文件系统”，而是把不可变镜像、随机访问和透明压缩结合在一起的专用文件系统。
