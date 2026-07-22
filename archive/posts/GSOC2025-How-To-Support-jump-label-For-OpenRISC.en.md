---
slug: GSOC2025-How-To-Support-jump-label-For-OpenRISC.en
title: 'GSOC2025: How To Support jump_label For OpenRISC'
published: 2025-06-15
tags:
  - GSOC
  - OpenRISC
category: GSOC
series: gsoc2025
lang: "en"
---
`jump_label` is a mechanism in the Linux kernel used to optimize frequently toggled branch code (such as if-else, switch, etc.), especially in dynamically enabled/disabled debugging or performance monitoring scenarios. Its core idea is to dynamically modify code at runtime, converting conditional branches into unconditional jumps or plain no-ops (`NOP`), thereby reducing branch prediction overhead and improving performance (~~By DeepSeek~~).

Over the past few weeks, I have been studying various blogs about `jump_label`, source code analyses, and the corresponding kernel documentation, and I have learned the steps required to port and implement `jump_label`.

1. [Linux Kernel Documentation about static_key](https://www.kernel.org/doc/html/latest/staging/static-keys.html)
2. [Linux Kernel | Code Techniques: ARM64 jump label Source Code Analysis](https://zhuanlan.zhihu.com/p/699724456)
3. [Linux: A Brief Analysis of the Jump label Implementation - JiMoKuangXiangQu](https://www.cnblogs.com/JiMoKuangXiangQu/articles/18812838)
4. [The Principles and Examples of the Linux Kernel jump label and static key](https://blog.csdn.net/dog250/article/details/106715700)
5. [static key & jump label | The Crow's](https://www.hyuuhit.com/2025/05/05/static-key-jump-label/)

In the kernel documentation, there is a description of the most basic implementation order for `jump_label`:

![linux documentation jump_label](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250616231404.png)

`HAVE_ARCH_JUMP_LABEL` is the first step in the kernel to decide whether to enable `static_key`; it indicates whether the current hardware architecture implements the low-level support required by `jump_label`. `JUMP_LABEL_NOP_SIZE` ensures that the jump instruction and the NOP instruction have the same size when one is replaced by the other later (if the sizes differ, it causes problems such as instruction tearing).

Explaining concepts alone may be rather vague, so next let's look at an analysis of the corresponding source code to figure out how to port the `jump_label` implementation to OpenRISC.

## JumpLabel Source Code For RISC-V

To understand the overall runtime flow of `jump_label` in the kernel, we need to find its entry point (`jump_label_init`). But before that, we need to understand one concept: `jump_label` is essentially a table. To enable fast jumping, the kernel records the information of every jump site (that is, every `static_key`) in `__jump_table`, whose start and end addresses are delimited by `__start___jump_table` and `__stop___jump_table` respectively.

```c
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

The code above is the kernel's specification of the memory layout, which includes the layout information of `jump_table`. We can see that `jump_table` is aligned to eight bytes in memory, and there is a key piece of information here: `RO_AFTER_INIT_DATA`. This was the issue that Shorne and I identified together in `Patch V2`.

Now that we understand this (`__jump_table`), we can start analyzing from `jump_label_init`.

### JumpLabel Init Stage

In the `jump_label_init` function, we ignore the other unrelated code (not because it is unimportant, but because removing it does not affect our understanding).

```c
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

As shown above, this is the core code of `jump_label_init`. Since the functionality of `jump_label` is implemented by injecting assembly, the `jump_label` information is already written into `__jump_table` at compile time. This involves the implementations of `arch_static_branch` and `arch_static_branch_jump` mentioned in the kernel documentation above. (At this point, the `jump_entry` information is out of order.)

For a `static_key`, each `static_key` corresponds to more than one `jump_entry`. Therefore, to avoid duplicate processing and for performance considerations, the kernel first needs to sort the `jump_entry` entries (usually in ascending order of the address of the `static_key` that each `jump_entry` points to) before it can proceed to the next step.

Then, the address of the `jump_entry` needs to be checked to determine whether it is located within the `.init` section, and the second-to-last bit of `jump_entry->key` is configured via `jump_entry_set_init`.

```c
static inline void jump_entry_set_init(struct jump_entry *entry, bool set)
{
	if (set)
		entry->key |= 2; // set 1
	else
		entry->key &= ~2; // clear 1
}
```

Finally, `static_key_set_entries` ensures that the group of `jump_entry` entries corresponding to a `static_key` are linked together. If you want to enable the `jump_label` functionality, you need to trigger the `jump_label_update` function by passing parameters or through other means, and the `update` function in turn triggers the implementation of `arch_jump_label_transform` described in the documentation above.

At this point, the basic principles of `jump_label` have been explained. Next, I will describe my work and the corresponding handling.

## Implement JumpLabel For Or1k

### PATCH Draft

In the early hours of May 25, 2025, I sent Shorne an email titled <b>[PATCH] openrisc: tracing: Support the jump_label draft</b>.

![openrisc: tracing: Support the jump_label draft](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618163046.png)

In this `dratf patch`, I ported and implemented `jump_label` for the OpenRISC architecture, but I kept getting stuck at the virtual machine boot screen. At first, I kept thinking it was a `text_patch` problem, because at that time `text_patch` seemed to be the only part of my `patch` that was not implemented (since OpenRISC indeed does not yet have the `text_patch feature`). So I asked the following question:

[Need help implementing text_patch for JUMP_LABEL](https://lore.kernel.org/openrisc/f5a0b134-f82b-4f97-8f31-4520055d4be2@gmail.com/T/#t)

But in the subsequent discussion with Shorne, it turned out that this was not the key point (or rather, not a critical factor).

> Shorne: Note I was reading other jump_label implementation, the text patching feature seems options. but it would be good to implement a clean text patching API  
> Shorne: But not required

On the afternoon of May 25, 2025, Shorne read my `draft patch` and raised many questions:

```txt
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

These were questions about where to add `HAVE_ARCH_JUMP_LABEL` and `CONFIG_JUMP_LABEL`. Shorne wanted me to stay consistent with the rest of the kernel style, so I modified it right away.

```txt
> +#define WASM(inst) "l." #inst

Is this needed?  Why not just write l.nop and l.j below?
```

As for this question, it was actually caused by my reference to the `arm` style, because `arm` has the following code:

```c
#define WASM(instr)	#instr ".w"
```

But after thinking it over carefully, hardcoding it directly might be better. So this point was also modified.

```txt
> +             offset = jump_entry_target(entry) - jump_entry_code(entry);
> +             WARN_ON(offset < -33554432 || offset > 33554428);

Can we avoid using the integers here?  it is hard to read, also can you have
some comment explaining why this check isneeded?
```

This requires a detailed explanation. At the beginning, I referred to the porting implementation of `jump_label` on the `arm` architecture. The format of `b.w` on the `arm` architecture is as follows:

![arm b.w insn](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/477f8bc1-00e3-4281-8bfd-88e0d8b9438c.png)

In `b.w`, `arm` provides a 24-bit immediate, which corresponds to `b.w label`. The actual immediate calculation for the `arm` architecture is: `1 << 24 << 2`. Converted to a signed number, that is: `-33554432 ~ 33554428`. Therefore, in the `draft patch` I directly reused this data (because the immediate of OpenRISC's `l.j` is 26 bits, which is the same as `1 << 24 << 2`).

But I overlooked one point: the reason `arm` needs the trailing `<< 2` is for extended alignment; the same is true in OpenRISC:

![openrisc l.j insn](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618171437.png)

> The immediate value is shifted left two bits, sign-extended to program counter width, and
then added to the address of the jump instruction. The result is the effective address of the
jump.

Therefore, the actual value for OpenRISC should be calculated as a sign extension of 26 bits shifted left by two more bits:

```txt
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

As for the last question, Shorne pointed out that `HAVE_ARCH_JUMP_LABEL_RELATIVE` should also be implemented.

I checked the mainstream architectures (x86, arm64, RISC-V) and found that they indeed all implement the `HAVE_ARCH_JUMP_LABEL_RELATIVE` feature. Therefore, I added it in the subsequent `patch`.

`HAVE_ARCH_JUMP_LABEL_RELATIVE` affects two places:

- struct jump_label
- arch_static_branch and arch_static_branch_jump

```txt
> SHould this be added last?  Maybe its better to have in in the same location of
> the other 'select HAVE_*' definitions.

Additionally, I think this needs: HAVE_ARCH_JUMP_LABEL_RELATIVE

Also, we should update:

Documentation/features/core/jump-labels/arch-support.txt
```

By this point, the implementation of `jump_label` for OpenRISC had taken rough shape. Below is the screen where it fails to boot:

![cannot start with jump_label](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618172514.png)

### PATCH V1

On June 6, 2025, nearly two weeks had passed since the `draft patch` was completed. Because of my graduation thesis defense and the thesis itself, there had been no progress before then. That day, I suddenly noticed a phenomenon:

![](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618173604.png)

When I commented out the logic in this section of code that writes the `jump_entry`, I found that the kernel could boot normally. I immediately told Shorne about this phenomenon, but Shorne asked me: "**Do you understand this section of code and what it does?**"

I answered correctly at the time, but thinking back on it later, my understanding of this section of code was indeed not deep enough. Remember the `HAVE_ARCH_JUMP_LABEL_RELATIVE` flag? This is where `HAVE_ARCH_JUMP_LABEL_RELATIVE` comes into play:

```asm
".long   1b - ., " label " - . \n\t"
".word   " key " - .           \n\t"
```

Without `HAVE_ARCH_JUMP_LABEL_RELATIVE`, the format should actually be written the same way as on the `arm` architecture:

```asm
".word 1b, " label ", " key "\n\t"
```

In other words, `HAVE_ARCH_JUMP_LABEL_RELATIVE` actually determines that all fields of `jump_label` store offsets; without this flag, absolute addresses are stored instead, like on `arm`.

Then I got stuck here. A few days later, Shorne asked me: "**do you need my help to get it working?**"

YES, I NEED. Then I sent the first version, that is, `PATCH V1`, to Shorne.

### PATCH V2

Two days later, on June 13, 2025, Shorne and I started debugging together. At the beginning, Shorne provided a key piece of information:

```txt
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

It seemed that the previous crash was caused by a problem when `jump_label_init` was sorting. Then Shorne pointed out: "**Maybe this is the issue, the jump_table is stored in the .rodata section which is read only data**."

```c
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

On this point, Shorne and I reached an agreement: it must be that jump_label_init modified the data in `.rodata` while sorting. But on other architectures the sorting also happens within `.rodata`, **so there must be a mechanism that makes `.rodata` writable at that time**.

During my exchange with Shorne, one sentence of his caught my attention: "**but according the the failure it is not, we should if the page table is marking it as read only during setup**". Indeed, `.rodata` should normally be unmodifiable, but if at boot time `.rodata` has not yet been marked as read-only, then would `.rodata` be modifiable at that point?

The answer is yes. Nearly twenty minutes later, I found the answer. I said to Shorne with delight, "wow, look this! [linux kernel arch riscv setup.c#L312](https://github.com/torvalds/linux/blob/27605c8c0f69e319df156b471974e4e223035378/arch/riscv/kernel/setup.c#L312)". In the RISC-V architecture, the `setup_arch` function (which every architecture implements) calls a `setup_initial_init_mm` and a `paging_init` function at the very beginning. When I turned around to check the corresponding functions in OpenRISC, I found a pleasant surprise.

In OpenRISC's `paging_init`, there is such a call:

```c
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

When I moved the `jump_label_init` call to before `paging_init`, I could see that the terminal, which previously output nothing, started producing log output.

However, at that time, Shorne said to me, "**I don't think so, did you see the last message I pasted about mm being null, causing the failure? it was not the read only issue.**" Then he turned to studying the `dtlb_miss_handler` and `itlb_miss_handler`.

But subsequently, Shorne agreed with my finding:

```txt
> readelf -s vmlinux | grep -e _kernel_ro -e jump_table
29270: c0982440     0 NOTYPE  GLOBAL DEFAULT    2 __start___jump_table
31424: c0000000     0 NOTYPE  GLOBAL DEFAULT    1 _s_kernel_ro
33126: c098c000     0 NOTYPE  GLOBAL DEFAULT    8 _e_kernel_ro
37354: c0986d9c     0 NOTYPE  GLOBAL DEFAULT    2 __stop___jump_table
```

Here we can clearly see that the `__jump_table` is located within the `.rodata` region marked by `_s_kernel_ro` and `_e_kernel_ro`. But we found that even after this handling, failures still occurred. Then I analyzed `jump_label_init` and added a line of test code:

```txt
+       printk("static_key_initialized: %d", static_key_initialized);
+
        if (static_key_initialized)
                return;
```

Finally, from the logs we can see that `jump_label_init` is actually called twice. The first time, it is called in `setup_arch` (before `paging_init`); during this call, the contents of `__jump_table` are writable, which successfully resolves the crash in `jump_label_sort_entries`. Note that **on the first run, if it succeeds, `static_key_initialized` is set to `1`. Therefore, on the second execution, it returns directly here without performing initialization again**. So the crash actually happens somewhere else.

Then, Shorne obtained access to the console, which allowed us to see more log output:

```txt
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

The facts proved that `jump_label_init` succeeded; the problem was located in `arch_jump_label_transform_queue`. At that time, I always believed that `text_patch` was necessary, so I added a log here that would output `entry wrong place` if execution reached this point.

"**because missing the text_patch to flush?**", I said to Shorne. Then Shorne completed this part and verified that this `PATCH V2` indeed worked.

In the end, by referring to the RISC-V architecture's `text_patch`, Shorne found that RISC-V maps the `.rodata` data through `patch_map`, so that the `jump_label_update` after `paging_init` would not trigger an illegal address access.

```c
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

Then, Shorne sent `PATCH V2` to me.

```txt
Initial support for OpenRISC jumplabel support.  Currently causes
crashes after jump_label is initialized.

  - Need to support writing to memory by patching the page table to temporarily allow writes.
  - Need to see what needs to be done to flush SMP pages.
```

![PATCH V2](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618184508.png)

### PATCH V3

Late that night, Shorne suddenly said to me,

"**I think I figured out what the failure is., it boots now. You made a basic mistake, sending patch.**"

I was quite shocked at the time, wondering what the mistake was. Then Shorne said,

"**You were missing l.nop in the branch delay slots**"

Yes, OpenRISC requires delay slots. Here is a brief explanation of delay slots:

A delay slot is a special design in RISC (Reduced Instruction Set Computer) architectures (such as MIPS and SPARC) used to optimize pipeline execution efficiency. Its core idea is: before a branch instruction (such as a jump or a call) takes effect, the instruction immediately following it is allowed to execute, thereby reducing pipeline stalls — by dpsk(deepseek)

```asm
j    target      # jump to target
nop              # delay slot insn (Will be executed no matter what)

beq  $t0, $t1, label
add  $t2, $t3, $t4   # delay slot insn (Will be executed even if the branch is not taken)
```

After solving this problem, Shorne sent me `PATCH V3`. It could be said that this was my `jump_label first PATCH`.

![PATCH V3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618185504.png)

Of course, this `PATCH V3` was not so perfect; there were still many things to add. But finally, it could boot!

![Start OpenRISC Linux](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250618190005.png)

### PATCH MORE

TO BE DONE...
