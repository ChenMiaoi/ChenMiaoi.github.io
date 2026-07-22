---
slug: xv6-The-boot-loader.en
title: 'xv6: The boot loader'
published: 2024-05-15
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
lang: "en"
---
> Before we get started, I must make one statement: **this series of notes is intended for readers who already have some operating system fundamentals (including but not limited to: having written a simple OS, having taken an operating systems course at school, etc.). Therefore, I consider some of the content to be knowledge readers should already have, and I will not elaborate on it in detail**.

## Specify Memory Layout

Before we formally dive into the `xv6-riscv` source code, we first need to understand an operating system's memory layout — that is, the entry point of `xv6-riscv` and the layout of its various `section`s.

![xv6 内存布局](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405151629479.png)

As we can see, the entry point of the `xv6-riscv` operating system, namely `KERNBASE`, is located at physical address `0x8000'0000`, and it ends at `PHYSTOP` (that is, physical address `0x8640'0000`). This gives us:

$$
    PhysicalMemory(ram) = 0x8640'0000 - 0x8000'0000 = 0x640'0000
$$

Now, let's compare the memory layout diagram above against the corresponding `link-script`:

```txt
OUTPUT_ARCH( "riscv" )
ENTRY( _entry )

SECTIONS
{
  /*
   * ensure that entry.S / _entry is at 0x80000000,
   * where qemu's -kernel jumps.
   */
  . = 0x80000000;

  .text : {
    *(.text .text.*)
    . = ALIGN(0x1000);
    _trampoline = .;
    *(trampsec)
    . = ALIGN(0x1000);
    ASSERT(. - _trampoline == 0x1000, "error: trampoline larger than one page");
    PROVIDE(etext = .);
  }

  .rodata : {
    . = ALIGN(16);
    *(.srodata .srodata.*) /* do not need to distinguish this from .rodata */
    . = ALIGN(16);
    *(.rodata .rodata.*)
  }

  .data : {
    . = ALIGN(16);
    *(.sdata .sdata.*) /* do not need to distinguish this from .data */
    . = ALIGN(16);
    *(.data .data.*)
  }

  .bss : {
    . = ALIGN(16);
    *(.sbss .sbss.*) /* do not need to distinguish this from .bss */
    . = ALIGN(16);
    *(.bss .bss.*)
  }

  PROVIDE(end = .);
}
```

Let's analyze the meaning of this `kernel.ld` file line by line.

`OUTPUT_ARCH( "riscv" )` specifies that our target architecture is `risc-v`, while `ENTRY( _entry )` designates `_entry` as the program's entry point. **This is a very important setting: it determines which address the processor should jump to when the program starts executing. In operating system kernels and many other types of programs, this address is usually the starting location of the initialization code**.

As we already know from above, we set the program's entry address to `0x8000'0000`; in other words, we bind the entry address of `_entry` to `0x8000'0000`. Hence this statement:

```txt
. = 0x80000000;
```

That is to say, the following `section`s in the final generated image file will start at this address. This is also the address where `qemu-riscv` loads the kernel by default.

In the [qemu risc-v virt.c](https://github.com/qemu/qemu/blob/master/hw/riscv/virt.c) file, there is this definition:

```c 
static const MemMapEntry virt_memmap[] = {
    [VIRT_DRAM] = { 0x80000000,           0x0 },
};

const MemMapEntry *memmap = virt_memmap;
MachineState *machine = MACHINE(s);
target_ulong start_addr = memmap[VIRT_DRAM].base;
```

The specific commands executed for `qemu-riscv` are:

```bash
riscv64-linux-gnu-ld ... -T kernel.ld ... -o kernel ...
qemu-system-riscv64 -machine virt ... kernel -m 128M ...
```

Now that we've covered the entry point, we should introduce the various `section`s. For an introduction to `ELF Sections`, please consult Wikipedia or the [elf file pdf](https://refspecs.linuxbase.org/elf/elf.pdf) on your own.

From the memory map above, we can see that the first thing to allocate is the `.text section`. In the `Kernel text` mapping, the `Trampoline` is mapped into `.text` (the `trampoline` will be discussed later, so we won't describe it in detail here; you only need to know that the `trampoline` is allocated the size of one page). Hence the following statements in `kernel.ld`:

```txt
.text : {
    *(.text .text.*)
    . = ALIGN(0x1000);
    _trampoline = .;
    *(trampsec)
    . = ALIGN(0x1000);
    ASSERT(. - _trampoline == 0x1000, "error: trampoline larger than one page");
    PROVIDE(etext = .);
}
```

A brief introduction to the meaning of `.text`: **This section holds the "text", or executable instructions, of a program** — in other words, the `.text` section is the area where code text and instructions are stored. Now let's explain the statements above line by line:

- `*(.text .text.*)`: This line specifies that, at link time, all sections starting with `.text` and all sections consisting of `.text.` followed by any characters are placed into the `.text` section.
- `. = ALIGN(0x1000)`: This line aligns the current location (`.`) to a `0x1000` (i.e., $4MB/page$) byte boundary.
- `_trampoline = .`: This line assigns the value of the current location (`.`) to a symbol named `_trampoline`, which corresponds to the `Trampoline` mapping.
- `*(trampsec)`: This line adds all sections named `trampsec` (if any) into the `.text` section; its exact meaning will be introduced later.
- `. = ALIGN(0x1000)`: Aligns the current location (`.`) to a `0x1000`-byte boundary again, to ensure the size of the `.text` section is an integer multiple of the page size.
- `ASSERT(. - _trampoline == 0x1000, "error: trampoline larger than one page")`: Checks the size of the `Trampoline` mapping.
- `PROVIDE(etext = .)`: This line defines a symbol named `etext` and sets its value to the current location (`.`), defining a marker similar to `end_text`.

The second memory layout to map is `Kernel data`. Generally speaking, there are two kinds of `data`: **read-only data** and **readable-writable data**. In the `ELF` file format, `.rodata` is usually placed after `.text` and before `.data`.

```txt
rodata : {
    . = ALIGN(16);
    *(.srodata .srodata.*) /* do not need to distinguish this from .rodata */
    . = ALIGN(16);
    *(.rodata .rodata.*)
}
```

As for the meaning of `.rodata`: **These sections hold read-only data that typically contribute to a non-writable segment in the process image** — in other words, the `.rodata` section consists of read-only data. Now let's explain the statements above line by line:

- `. = ALIGN(16)`: This line aligns the current address to a 16-byte boundary.
- `*(.srodata .srodata.*)`: Places all `.srodata` sections and sections starting with `.srodata.` found at link time into the current section (i.e., the `.rodata` section). This includes sections like `.srodata` and `.srodata.foo`. These sections usually contain read-only data.
- `*(.rodata .rodata.*)`: Places all `.rodata` sections and sections starting with `.rodata.` found at link time into the current section (i.e., the `.rodata` section).

```txt
.data : {
    . = ALIGN(16);
    *(.sdata .sdata.*) /* do not need to distinguish this from .data */
    . = ALIGN(16);
    *(.data .data.*)
}

.bss : {
    . = ALIGN(16);
    *(.sbss .sbss.*) /* do not need to distinguish this from .bss */
    . = ALIGN(16);
    *(.bss .bss.*)
}

PROVIDE(end = .);
```

The `.data` and `.bss` sections allocated next will not be elaborated on here. The meaning of `.data` is: **These sections hold initialized data that contribute to the program's memory image** — in other words, the `.data` section contains initialized data; and the meaning of `.bss` is: **This section holds uninitialized data that contribute to the program's memory image** — in other words, `.bss` contains uninitialized data.

At this point, the simple memory layout of `xv6-riscv` is set up. Now let's shift our attention from the memory layout to the kernel entry point.

## Kernel Entry Point

Needless to say, our kernel environment is definitely "bare metal". Therefore, we need to set up our entry function according to the entry point established in the memory layout above. And the way to enter our entry function is to jump directly to the entry address through assembly.

```asm
.section .text
.global _entry
_entry:
        # set up a stack for C.
        # stack0 is declared in start.c,
        # with a 4096-byte stack per CPU.
        # sp = stack0 + (hartid * 4096)
        la sp, stack0
        li a0, 1024*4
        csrr a1, mhartid
        addi a1, a1, 1
        mul a0, a0, a1
        add sp, sp, a0
        # jump to start() in start.c
        call start
spin:
        j spin
```

We can see one crucial point: the declaration of the `.text` section. From the previous section we know that `Kernel text`, i.e. `.text`, starts at address `0x8000'0000`, and that `.text` is where code text and program instructions are stored. Therefore, when the kernel boots, it starts `_entry` as the entry point, and that entry point leads into the block of code above.

Now let's explain its meaning statement by statement:

```asm
#define NCPU          8  // maximum number of CPUs
__attribute__ ((aligned (16))) char stack0[4096 * NCPU];
la sp, stack0
```

First, we need to allocate a corresponding kernel stack for each `hart`. One interesting thing to note is `__attribute__ ((aligned (16)))` — consistent with how we allocated `.bss`, a sixteen-byte alignment is required.

```asm
li a0, 1024*4
```

This sets the size of the kernel stack corresponding to each `hart`.

```asm
csrr a1, mhartid
addi a1, a1, 1
mul a0, a0, a1
add sp, sp, a0
```

It reads the hardware thread `ID` from the `mhartid` register, computes the offset of each `hart`'s own kernel stack, and then sets the `sp` pointer to the current `hart`'s dedicated kernel stack location.

```asm
call start
```

Finally, it jumps into the `start` function, and the `start` function is the beginning of the entire kernel. The corresponding actual assembly code is given below:

```asm
0000000080000000 <_entry>:
    80000000:	00009117          	auipc	sp,0x9
    80000004:	a1010113          	addi	sp,sp,-1520 # 80008a10 <stack0>
    80000008:	6505                	lui	a0,0x1
    8000000a:	f14025f3          	csrr	a1,mhartid
    8000000e:	0585                	addi	a1,a1,1
    80000010:	02b50533          	mul	a0,a0,a1
    80000014:	912a                	add	sp,sp,a0
    80000016:	078000ef          	jal	ra,8000008e <start>
    
000000008000008e <start>:
{
    8000008e:	1141                	addi	sp,sp,-16
    ...
```

From this, we can see that the `_entry` entry point is indeed at address `0x8000'0000`, and it will correctly jump into the `start` function in the end. Meanwhile, in the `start` function, the `sp` pointer used is also the kernel stack dedicated to the current `hart`.

> RISC-V Hart  
>> In the `RISC-V` architecture, `hart` stands for hardware thread (`hardware thread`). In a multi-core processor, each core can have one or more `hart`s. Each hart has a unique identifier in the system, called the hart ID. In the `RISC-V` architecture, the `ID` of the currently executing `hart` can be obtained by reading a specific `CSR(Control and Status Register)`, usually the `mhartid` register.

![hart](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405152046139.png)
