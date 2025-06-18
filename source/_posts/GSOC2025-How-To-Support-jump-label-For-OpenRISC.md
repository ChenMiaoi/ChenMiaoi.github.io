---
title: 'GSOC2025: How To Support jump_label For OpenRISC'
mathjax: true
date: 2025-06-15 21:00:14
tags: [GSOC, OpenRISC]
categories: [GSOC]
---

# GSOC 2025: How To Support jump_label For OpenRISC

`jump_label`是Linux内核中的一种机制，用于优化频繁切换的分支代码（如 if-else、switch 等），特别是在动态启停的调试或性能监控场景中。其核心思想是通过运行时动态修改代码，将条件分支转换为无条件跳转或直接空操作(`NOP`)，从而减少分支预测开销，提升性能(~~By DeepSeek~~)。

在过去的几周内，我通过学习`jump_label`的各种博客，源码剖析以及对应的内核文档。了解到移植并实现`jump_label`需要的步骤。

1. [Linux Kernel Documentation about static_key](https://www.kernel.org/doc/html/latest/staging/static-keys.html)
2. [【Linux内核|代码技巧】ARM64 jump label源码分析](https://zhuanlan.zhihu.com/p/699724456)
3. [Linux：Jump label 实现简析 - JiMoKuangXiangQu](https://www.cnblogs.com/JiMoKuangXiangQu/articles/18812838)
4. [Linux内核jump label与static key的原理与示例](https://blog.csdn.net/dog250/article/details/106715700)
5. [static key & jump label | 属乌鸦的](https://www.hyuuhit.com/2025/05/05/static-key-jump-label/)

在内核的文档中，有关于最为基础的`jump_label`实现顺序：

![linux documentation jump_label](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250616231404.png)

`HAVE_ARCH_JUMP_LABEL`是内核中决定是否开启`static_key`的第一步，这指出当前硬件架构是否实现了`jump_label`所需的底层支持。而`JUMP_LABEL_NOP_SIZE`则是为了确保后续跳转指令和NOP指令替换时，指令大小一致(如果不一致，则会导致指令撕裂等问题)。

可能单单讲解概念会比较模糊，我们接下来先看看对应源码的剖析进而来分析如何移植OpenRISC的`jump_label`实现。

## JumpLabel Source Code For RISC-V

要了解内核中`jump_label`的整体运行流程，我们就需要找到`jump_label`的运行入口(`jump_label_init`)。但这在之前，我们还需要了解到一个概念，`jump_label`实际上是一张表格，为了实现快速跳转，内核将每一个跳转点(也就是`static_key`)的信息都记录在`__jump_table`中，分别由`__start___jump_table`和`__stop___jump_table`控制起始和结尾地址。

``` c
#define JUMP_TABLE_DATA							\
	. = ALIGN(8);							\
	BOUNDED_SECTION_BY(__jump_table, ___jump_table)
	
/*
 * Allow architectures to handle ro_after_init data on their
 * own by defining an empty RO_AFTER_INIT_DATA.
 */
#ifndef RO_AFTER_INIT_DATA
#define RO_AFTER_INIT_DATA						\
	. = ALIGN(8);							\
	__start_ro_after_init = .;					\
	*(.data..ro_after_init)						\
	JUMP_TABLE_DATA							\
	STATIC_CALL_DATA						\
	__end_ro_after_init = .;
#endif
```

上面的代码是内核对内存布局的指示，其中就包含了`jump_table`的布局信息。我们可以看到，`jump_table`以八字节对齐在内存中，并且其中有一个关键信息`RO_AFTER_INIT_DATA`。这一点是在`Patch V2`中和Shorne一起检查出的问题。

了解到这一点后(`__jump_table`)，我们现在就可以开始从`jump_label_init`开始分析了。

### JumpLabel Init Stage

在`jump_label_init`函数中，我们忽视掉其他无关代码(并非说它们不重要，而是去除掉这些代码并不会影响理解)。

``` c
void __init jump_label_init(void)
{
	struct jump_entry *iter_start = __start___jump_table;
	struct jump_entry *iter_stop = __stop___jump_table;
	struct static_key *key = NULL;
	struct jump_entry *iter;
	
	jump_label_sort_entries(iter_start, iter_stop);

	for (iter = iter_start; iter < iter_stop; iter++) {
		struct static_key *iterk;
		bool in_init;

		in_init = init_section_contains((void *)jump_entry_code(iter), 1);
		jump_entry_set_init(iter, in_init);

		iterk = jump_entry_key(iter);
		if (iterk == key)
			continue;

		key = iterk;
		static_key_set_entries(key, iter);
	}
	static_key_initialized = true;
}
```

如上，这就是`jump_label_init`的核心代码部分。由于`jump_label`的功能是通过注入汇编实现的，因此在编译阶段`jump_label`的信息便已经写入到`__jump_table`中。这里便涉及到上面内核文档中所提到的`arch_static_branch`和`arch_static_branch_jump`的实现。(此时，`jump_entry`的信息都是乱序的)。

对于一个`static_key`来说，每一个`static_key`都不止对应了一个`jump_entry`因此为了防止重复处理以及性能考虑，内核首先需要对`jump_entry`进行排序(通常是按照`jump_entry`指向`static_key`的地址按升序排列)，然后才能开始下一步操作。

然后需要对该`jump_entry`的地址进行检查是否位于`.init`段内，然后通过`jump_entry_set_init`对`jump_entry->key`的倒数第二比特进行配置。

``` c
static inline void jump_entry_set_init(struct jump_entry *entry, bool set)
{
	if (set)
		entry->key |= 2; // set 1
	else
		entry->key &= ~2; // clear 1
}
```

最后通过`static_key_set_entries`来确保`static_key`对应的一组`jump_entry`被关联到一起。如果想要启用`jump_label`的功能，则需要通过传入参数或其他方式，触发`jump_label_update`函数，而`update`函数则会触发上述文档中关于`arch_jump_label_transform`的实现。

至此，简单的`jump_label`的原理便已经阐述完毕。接下来开始陈述我的工作以及对应处理。

## Implement JumpLabel For Or1k

### PATCH Draft

2025年5月25日凌晨，我对Shorne发送了一个名为<b>《[PATCH] openrisc: tracing: Support the jump_label draft》</b>的邮件。

![openrisc: tracing: Support the jump_label draft](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618163046.png)

在这一份`dratf patch`中，我针对于OpenRISC架构的`jump_label`进行移植和实现，但始终卡在了虚拟机启动界面。其中，一开始我一直认为是`text_patch`的问题，因为当时我的`patch`看上去只有`text_patch`没有实现(因为OpenRISC目前确实还没有`text_patch feature`)。因此我还有了以下的一个提问：

[《Need help implementing text_patch for JUMP_LABEL》](https://lore.kernel.org/openrisc/f5a0b134-f82b-4f97-8f31-4520055d4be2@gmail.com/T/#t)

但在随后与Shorne的讨论中，发现这并不是一个重点(或许说，这不是一个关键因素)。

> Shorne: Note I was reading other jump_label implementation, the text patching feature seems options. but it would be good to implement a clean text patching API  
> Shorne: But not required

2025年5月25日下午，Shorne对我的`draft patch`进行阅读，然后给出了许多提问：

``` txt
> --- a/arch/openrisc/Kconfig
> +++ b/arch/openrisc/Kconfig
> @@ -44,6 +44,7 @@ config OPENRISC
>       select GENERIC_IRQ_MULTI_HANDLER
>       select MMU_GATHER_NO_RANGE if MMU
>       select TRACE_IRQFLAGS_SUPPORT
> +     select HAVE_ARCH_JUMP_LABEL

SHould this be added last?  Maybe its better to have in in the same location of
the other 'select HAVE_*' definitions.

> +obj-$(CONFIG_JUMP_LABEL)     += jump_label.o
> +

Why have this separated out with newlines?  Can it be alphabetically sorted?
```

这里是关于`HAVE_ARCH_JUMP_LABEL`和`CONFIG_JUMP_LABEL`的添加位置的提问，Shorne希望我与其他内核风格保持一直，因此我立刻修改了。

``` txt
> +#define WASM(inst) "l." #inst

Is this needed?  Why not just write l.nop and l.j below?
```

针对于这个问题，实际上是我参考了`arm`的风格所导致的，因为`arm`有如下代码：

``` c
#define WASM(instr)	#instr ".w"
```

但仔细想想之后，直接硬编码进去可能更好一些。所以这一点也进行了修改。

``` txt
> +             offset = jump_entry_target(entry) - jump_entry_code(entry);
> +             WARN_ON(offset < -33554432 || offset > 33554428);

Can we avoid using the integers here?  it is hard to read, also can you have
some comment explaining why this check isneeded?
```

这里需要进行详细解释了。在一开始，我参考了`arm`架构的`jump_label`的移植实现。而`arm`架构的`b.w`的格式如下：

![arm b.w insn](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/477f8bc1-00e3-4281-8bfd-88e0d8b9438c.png)

在`b.w`中，`arm`提供了24位的立即数，也就是对应了`b.w label`。而对于`arm`架构的实际立即数计算为：`1 << 24 << 2`。然后换算为有符号数即为：`-33554432 ~ 33554428`。因此，我在`draft patch`中直接沿用了这一数据(因为OpenRISC的`l.j`的立即数是26位的，和`1 << 24 << 2`相同)。

但是我忽略了一点，`arm`之所以后面需要`<< 2`，是因为需要扩展对齐；在OpenRISC中也是如此：

![openrisc l.j insn](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618171437.png)

> The immediate value is shifted left two bits, sign-extended to program counter width, and
then added to the address of the jump instruction. The result is the effective address of the
jump.

因此，实际上的OpenRISC对应的数值应该按照26比特再向左位移两个比特的有符号扩展进行计算：

``` txt
> +               /*
> +                * The actual maximum range of the l.j instruction's offset is -134,217,728
> +                * ~ 134,217,724 (sign 26-bit imm).
> +                * For the original jump range, we need to right-shift N by 2 to obtain the
> +                * instruction's offset.
> +                */
> +               if (unlikely(offset < -134217728 || offset > 134217724)) {
> +                       WARN_ON_ONCE(true);
> +               }
> +               /* 26bit imm mask */
> +               offset = (offset >> 2) & 0x03ffffff;
```

而最后一个问题，Shorne指出：`HAVE_ARCH_JUMP_LABEL_RELATIVE`也应被实现。

我查阅了主流架构(x86、arm64、RISC-V)，发现它们确实都实现了`HAVE_ARCH_JUMP_LABEL_RELATIVE`这一个feature。因此，我在后续的`patch`中进行了添加。

`HAVE_ARCH_JUMP_LABEL_RELATIVE`会影响两个地方：

- struct jump_label
- arch_static_branch和arch_static_branch_jump

``` txt
> SHould this be added last?  Maybe its better to have in in the same location of
> the other 'select HAVE_*' definitions.

Additionally, I think this needs: HAVE_ARCH_JUMP_LABEL_RELATIVE

Also, we should update:

Documentation/features/core/jump-labels/arch-support.txt
```

到现在，OpenRISC的`jump_label`的实现就已经有了大致雏形了。如下是无法开机的界面：

![cannot start with jump_label](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618172514.png)

### PATCH V1

2025年6月6日，自`draft patch`的完成已经过去快两周，因为毕业答辩和毕业论文的事情，因此之前都没有进展。当天我突然发现一个现象：

![](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618173604.png)

当我把这一段代码的`jump_entry`写入的逻辑注释掉后，我发现内核可以正常启动。我立即将这一现象告诉Shorne，但Shorne问我: "**Do you understand this section of code and what it does?**"

当时我回答了正确了，但是后面回来一想，确实我当时对这一段代码的理解不够深入。还记得`HAVE_ARCH_JUMP_LABEL_RELATIVE`这个flag吗？`HAVE_ARCH_JUMP_LABEL_RELATIVE`在这里就起了作用：

``` asm
".long   1b - ., " label " - . \n\t"
".word   " key " - .           \n\t"
```

如果没有`HAVE_ARCH_JUMP_LABEL_RELATIVE`，那么实际上就应该如同`arm`架构一样的编写格式：

``` asm
".word 1b, " label ", " key "\n\t"
```

也就是说，`HAVE_ARCH_JUMP_LABEL_RELATIVE`实际上决定了`jump_label`的所有字段是保存偏移量的，如果没有这个flag，则就会类似于`arm`这样保存绝对地址。

然后我就卡在这里了，过了几天后，Shorne问我："**do you need my help to get it working?**"

YES, I NEED. 然后我就把第一版也就是`PATCH V1`发送给了Shorne。

### PATCH V2

两天后，2025年6月13日，我和Shorne开始一起调试。一开始，Shorne提供了一个关键信息：

``` txt
[    0.000000] jump_label_cmp: a: c0988d24 vs b: c0988d30 keya: c09cc614 vs keyb: c09cc634
[    0.000000] jump_label_cmp: a: c098687c vs b: c0988d30 keya: c09c7174 vs keyb: c09cc634

[    0.000000] Stack: 
[    0.000000] Call trace:
[    0.000000] [<(ptrval)>] __sort_r+0x2e4/0x3c0
--Type <RET> for more, q to quit, c to continue without paging-- 
[    0.000000] [<(ptrval)>] ? start_kernel+0x0/0x770
[    0.000000] [<(ptrval)>] sort+0x34/0x44
[    0.000000] [<(ptrval)>] ? setup_arch+0x138/0x1b0
[    0.000000] [<(ptrval)>] ? jump_label_cmp+0x0/0x84
[    0.000000] [<(ptrval)>] ? jump_label_swap+0x0/0x6c
[    0.000000] [<(ptrval)>] jump_label_init+0x74/0x134
[    0.000000] [<(ptrval)>] ? start_kernel+0x90/0x770
[    0.000000] [<(ptrval)>] ? start_kernel+0x0/0x770
```

貌似之前的崩溃是因为`jump_label_init`在排序时出了问题。然后Shorne指出: "**Maybe this is the issue, the jump_table is stored in the .rodata section which is read only data**."

``` c
c00f6de8 <jump_label_swap>:
c00f6de8:       9c 21 ff f8     l.addi r1,r1,-8
c00f6dec:       e2 23 20 02     l.sub r17,r3,r4
c00f6df0:       86 64 00 00     l.lwz r19,0(r4)
c00f6df4:       e2 73 88 02     l.sub r19,r19,r17
c00f6df8:       86 a3 00 00     l.lwz r21,0(r3)
c00f6dfc:       d4 03 98 00     l.sw 0(r3),r19 <--- this line
c00f6e00:       86 e4 00 04     l.lwz r23,4(r4)
c00f6e04:       e2 f7 88 02     l.sub r23,r23,r17
c00f6e08:       86 63 00 04     l.lwz r19,4(r3)

static void jump_label_swap(void *a, void *b, int size)                        
{                                                                              
      long delta = (unsigned long)a - (unsigned long)b;                      
      struct jump_entry *jea = a;                                            
      struct jump_entry *jeb = b;                                            
      struct jump_entry tmp = *jea;                                          
                                                                             
      jea->code       = jeb->code - delta;    <---   this line                             
      jea->target     = jeb->target - delta;                                 
      jea->key        = jeb->key - delta;                                    
                                                                             
      jeb->code       = tmp.code + delta;
```

在这一点上，Shorne和我达成了一致：一定是因为jump_label_init在排序时，对`.rodata`的数据进行了修改。但是其他架构的排序也是发生在`.rodata`内，**因此肯定有一种机制使得`.rodata`当时是允许修改的**。

在和Shorne的交流中，他的一句话引起了我的注意："**but according the the failure it is not, we should if the page table is marking it as read only during setup**"。确实，`.rodata`按理来说是无法被修改的，但是如果在启动时，`.rodata`还未被标记为只读状态，那么是否这时候的`.rodata`是能够被修改的呢？

答案是肯定的，接近二十分钟后，我找到了答案。我惊喜的和Shorne说，"wow, look this! [linux kernel arch riscv setup.c#L312](https://github.com/torvalds/linux/blob/27605c8c0f69e319df156b471974e4e223035378/arch/riscv/kernel/setup.c#L312)"。在RISC-V架构中，`setup_arch`函数(每一个架构都会进行实现)中在最开始就会调用一个`setup_initial_init_mm`和`paging_init`函数。当我转过头去查看OpenRISC的对应函数时，发现了惊喜。

在OpenRISC的`paging_init`中有这样的一个调用：

``` c
extern const char _s_kernel_ro[], _e_kernel_ro[];

static void __init map_ram(void)
{
    ...
    if (v >= (u32) _e_kernel_ro ||
        v < (u32) _s_kernel_ro)
        prot = PAGE_KERNEL;
    else
        prot = PAGE_KERNEL;

    set_pte(pte, mk_pte_phys(p, prot));
    ...
}

void __init paging_init(void)
{
    ...
    map_ram();
    ...
}
```

当我将`jump_label_init`在`paging_init`之前进行调用时，就能够发现原本不会输出任何信息的终端开始有日志输出了。

不过当时，Shorne和我说，"**I don't think so, did you see the last message I pasted about mm being null, causing the failure? it was not the read only issue.**"。然后转而对`dtlb_miss_handler`和`itlb_miss_handler`进行研究。

但随后，Shorne同意了我的结果：

``` txt
> readelf -s vmlinux | grep -e _kernel_ro -e jump_table
29270: c0982440     0 NOTYPE  GLOBAL DEFAULT    2 __start___jump_table
31424: c0000000     0 NOTYPE  GLOBAL DEFAULT    1 _s_kernel_ro
33126: c098c000     0 NOTYPE  GLOBAL DEFAULT    8 _e_kernel_ro
37354: c0986d9c     0 NOTYPE  GLOBAL DEFAULT    2 __stop___jump_table
```

在这里就可以清晰的看到，`_s_kernel_ro`和`_e_kernel_ro`被写入到`.rodata`中了。但是我们发现，经过这样处理后还是会出现失败的情况，然后我对`jump_label_init`进行了分析，增加了一条测试代码：

``` txt
+       printk("static_key_initialized: %d", static_key_initialized);
+
        if (static_key_initialized)
                return;
```

最后在日志中可以发现，`jump_label_init`实际上会调用两次，第一次在`setup_arch`中(位于`paging_init`之前)被调用，在这次调用的时候，`__jump_table`的内容是可写的，因此成功解决了`jump_label_sort_entries`的崩溃问题。需要注意，**第一次运行时，如果成功了会将`static_key_initialized`设置为`1`。因此在第二次执行时，这里就直接返回，不再进行初始化**。因此崩溃的实际上在另外的地方。

然后，Shorne对控制台的权限进行了获取，这样能够看到更多的日志输出：

``` txt
0xefc68a77:     ""
0xefc68a78:     "?\377\3742printk: legacy bootconsole [ns16550a0] disableded\n"
0xefc68aaf:     ""
0xefc68ab0:     "?\377\3743", '[' <repeats 16 times>, "entry wrong place", ']' <repeats 20 times>, "40.00 BogoMIPS (lpj=200000)0)\n"
0xefc68b08:     "?\377\3744pid_max: default: 32768 minimum: 30101\n"
0xefc68b34:     "?\377\3745Mount-cache hash table entries: 2048 (order: 0, 8192 bytes, linear)r)\n"
0xefc68b7f:     ""
0xefc68b80:     "?\377\3746Mountpoint-cache hash table entries: 2048 (order: 0, 8192 bytes, linear)r)\n"
0xefc68bd0:     ""
0xefc68bd1:     ""
```

事实证明了，`jump_label_init`成功，这里是位于`arch_jump_label_transform_queue`出现了问题。当时我始终认为`text_patch`是必须的，因此在这里加了一个日志，如果运行到这里就会输出`entry wrong place`。

"**because missing the text_patch to flush?**"，我对Shorne说，然后Shorne对这块进行了补全，并且验证了这个`PATCH V2`确实可行。

最终，Shorne通过参考RISC-V架构的`text_patch`，发现RISC-V会通过`patch_map`对`.rodata`的数据进行映射，这样就不会引发`paging_init`后的`jump_label_update`的非法地址访问。

``` c
waddr = patch_map(addr, FIX_TEXT_POKE0);

	ret = copy_to_kernel_nofault(waddr, insn, len);

/*
 * We could have just patched a function that is about to be
 * called so make sure we don't execute partially patched
 * instructions by flushing the icache as soon as possible.
 */
local_flush_icache_range((unsigned long)waddr,
             (unsigned long)waddr + len);

patch_unmap(FIX_TEXT_POKE0);
```

然后，Shorne发送了`PATCH V2`给我。

``` txt
Initial support for OpenRISC jumplabel support.  Currently causes
crashes after jump_label is initialized.

  - Need to support writing to memory by patching the page table to temporarily allow writes.
  - Need to see what needs to be done to flush SMP pages.
```

![PATCH V2](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618184508.png)

### PATCH V3

当天深夜，Shorne突然和我说，

"**I think I figured out what the failure is., it boots now. You made a basic mistake, sending patch.**"

我当时十分震惊，心想是什么错误。然后Shorne说，

"**You were missing l.nop in the branch delay slots**"。

是的，OpenRISC需要延迟槽。这里简单解释下延迟槽：

延迟槽（Delay Slot）是RISC（精简指令集计算机）架构（如MIPS、SPARC）中的一种特殊设计，用于优化流水线执行效率。它的核心思想是：在分支指令（如跳转、调用）生效之前，允许执行紧随其后的下一条指令，从而减少流水线停顿（Pipeline Stall）—— by dpsk(deepseek)

``` asm
j    target      # jump to target
nop              # delay slot insn (Will be executed no matter what)

beq  $t0, $t1, label
add  $t2, $t3, $t4   # delay slot insn (Will be executed even if the branch is not taken)
```

解决完这个问题后，Shorne给我发送了`PATCH V3`，应该说，这就是我的`jump_label first PATCH`。

![PATCH V3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618185504.png)

当然，这个`PATCH V3`并没有那么完美，还有很多事情需要补充。但是，终于可以开机了！

![Start OpenRISC Linux](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618190005.png)

### PATCH MORE

TO BE DONE...
