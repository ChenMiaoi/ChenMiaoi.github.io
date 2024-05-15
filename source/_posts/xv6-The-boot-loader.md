---
title: 'xv6: The boot loader'
mathjax: true
date: 2024-05-15 16:16:39
tags: [xv6, os, risc-v]
categories: [xv6]
---

# XV6 Operator System: 01-The Boot Loader

---  

> 在开始讲述内容前，我必须声明的是：**本系列笔记是针对于有一定操作系统基础的(包括不限于：写过简单的OS，学校课程所学的操作系统课等)，因此部分内容个人认为是读者应该知晓的知识，因此不会做过多赘述**。

## Specify Memory Layout

在我们正式介绍`xv6-riscv`源码之前，我们首先得了解一个操作系统的内存布局。也就是，`xv6-riscv`的入口点以及各个`section`的布局。

![xv6 内存布局](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405151629479.png)

我们可以看见，`xv6-riscv`操作系统的入口点，也就是`KERNBASE`位于物理内存的`0x8000'0000`处，并且结束于`PHYSTOP`(也就是物理内存的`0x8640'0000`)处，这样我们就得到：

$$
    PhysicalMemory(ram) = 0x8640'0000 - 0x8000'0000 = 0x640'0000
$$

现在，现在让我们根据上面的内存布局图来对照对应的`link-script`：

```ld
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

我们逐一的来分析该`kernel.ld`文件的含义。

对于`OUTPUT_ARCH( "riscv" )`来说，是指明我们的生成架构是`risc-v`，而`ENTRY( _entry )`指定程序的入口点为 _entry。**这是一个非常重要的配置，用于确定当程序开始执行时，处理器应该跳转到哪个地址开始执行代码。在操作系统内核和许多其他类型的程序中，这个地址通常是初始化代码的起始位置**。

我们在上文已经知道，我们设置程序的入口地址为`0x8000'0000`，也就是说，我们将`_entry`的入口地址绑定为`0x8000'0000`，因此，可以看见这一语句：

```ld
. = 0x80000000;
```

也就是说，我们最终生成的镜像文件中的以下`section`会从该地址处开始。同时，这也是`qemu-riscv`默认加载内核的地址。

在[qemu risc-v virt.c](https://github.com/qemu/qemu/blob/master/hw/riscv/virt.c)文件中，有该定义:

```c 
static const MemMapEntry virt_memmap[] = {
    [VIRT_DRAM] = { 0x80000000,           0x0 },
};

const MemMapEntry *memmap = virt_memmap;
MachineState *machine = MACHINE(s);
target_ulong start_addr = memmap[VIRT_DRAM].base;
```

具体`qemu-riscv`执行的语句为：

```bash
riscv64-linux-gnu-ld ... -T kernel.ld ... -o kernel ...
qemu-system-riscv64 -machine virt ... kernel -m 128M ...
```

介绍完入口点后，我们就应该介绍各个`section`了，有关于`ELF Sections`的介绍，请读者自行查阅维基百科或[elf file pdf](https://refspecs.linuxbase.org/elf/elf.pdf)。

根据上方的内存映射，我们可以看见，第一个应该分配的便是`.text section`，其中，在`Kernel text`的映射中，`Trampoline`被映射到`.text`中(关于`trampoline`在后续讲述，此处不做过多描述，只需要知道的是: `trampoline`的大小被分配为一个页)，因此可以看见`kernel.ld`中的语句：

```ld
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

关于`.text`的含义，这里做出简要介绍：**This section holds the "text", or executable instructions, of a program**，也就是说，`.text`段是代码文本和指令存放的区域。现在，让我们来逐语句解释上面的语句含义：

- `*(.text .text.*)`: 这一行指定了在链接时将所有以`.text`开头的段(section)和所有`.text.`后跟任意字符的段都放置到`.text`段中。
- `. = ALIGN(0x1000)`: 这一行将当前位置(.)对齐到`0x1000`(即$4MB/page$)字节的边界。
- `_trampoline = .`: 这一行将当前位置(.)的值赋给名为`_trampoline`的符号，这对应了`Trampoline`的映射
- `*(trampsec)`: 这一行将所有名为`trampsec`的段(如果有的话)添加到`.text`段中，其具体含义后续介绍
- `. = ALIGN(0x1000)`: 再次将当前位置(.)对齐到`0x1000`字节的边界，以确保`.text`段的大小是页面大小的整数倍
- `ASSERT(. - _trampoline == 0x1000, "error: trampoline larger than one page")`: 对`Trampoline`的映射大小做出检测
- `PROVIDE(etext = .)`: 这一行定义了一个名为`etext`的符号，并将其值设置为当前位置(.)，这定义了一个类似于`end_text`的符号标识

第二个映射的内存布局便是`Kernel data`，一般而言，`data`是有两种的，**只读数据**以及**可读可写数据**。在`ELF`文件格式中，`.rodata`通常是放于`.text`之后，`.data`之前的。

```ld 
rodata : {
    . = ALIGN(16);
    *(.srodata .srodata.*) /* do not need to distinguish this from .rodata */
    . = ALIGN(16);
    *(.rodata .rodata.*)
}
```

关于`.rodata`的含义：**These sections hold read-only data that typically contribute to a non-writable segment in the process image**，也就是说，`.rodata`段是由只读数据构成的。现在，让我们来逐语句解释上面的语句含义:

- `. = ALIGN(16)`: 这行代码将当前的地址对齐到16字节边界。
- `*(.srodata .srodata.*)`: 表示将所有在链接时发现的`.srodata`段和以`.srodata.`开头的段放入当前段(即`.rodata`段)。这包括类似`.srodata`和`.srodata.foo`这样的段。这些段通常包含只读数据。
- `*(.rodata .rodata.*)`: 表示将所有在链接时发现的`.rodata`段和以`.rodata.`开头的段放入当前段(即`.rodata`段)

```ld 
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

紧接着的分配的`.data`和`.bss`段，这里不再赘述，而`.data`的含义为: **These sections hold initialized data that contribute to the program's memory image**，也就是说，`.data`段包含了初始化的数据；而`.bss`段的含义为：**This section holds uninitialized data that contribute to the program's memory image**，也就是说，`.bss`包含了未初始化数据。

至此，`xv6-riscv`简单的内存布局便设置好了，现在，让我们把视角从内存布局处移到内核入口点。

## Kernel Entry Point

不用多说，我们的内核环境肯定是"裸机的"，因此，我们需要根据上面的内存布局设置的入口点，设置我们的入口函数。而如何进入我们的入口函数，就需要通过汇编直接跳转到入口地址了。

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

我们可以看见一个很关键的地方：`.text`段的声明，我们在上面一节中知道，`Kernel text`也就是`.text`是从`0x8000'0000`地址处开始的，并且，`.text`是存储代码文本和程序指令的地方。因此，当内核启动时，会启动`_entry`作为入口点，而该入口点，就进入了上面的这一块代码。

现在，让我们来逐语句的解释其含义：

```asm
#define NCPU          8  // maximum number of CPUs
__attribute__ ((aligned (16))) char stack0[4096 * NCPU];
la sp, stack0
```

我们首先要为每一个`hart`分配对应的内核栈，而有一个比较有趣的现象是，`__attribute__ ((aligned (16)))`，这与我们分配`.bss`的时候一致，需要进行十六个字节的对齐。

```asm
li a0, 1024*4
```

这里是设置了每一个`hart`对应的内核栈大小。

```asm
csrr a1, mhartid
addi a1, a1, 1
mul a0, a0, a1
add sp, sp, a0
```

从`mhartid`寄存器中读取硬件线程`ID`，计算出每一个`hart`自身对应的内核栈的偏移量，然后设置`sp`指针指向当前`hart`的专属内核栈位置。

```asm
call start
```

最终转跳到`start`函数中，而`start`函数，便是整个内核的开始位置。下面给出对应的实际汇编代码：

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

由此，可以看见，`_entry`入口点确实在`0x8000'0000`地址处，而最终也会正确的转跳到`start`函数中。同时，在`start`函数中，使用的`sp`指针也是独属于当前`hart`的内核栈。

> RISC-V Hart  
>> 在`RISC-V`架构中，`hart`代表硬件线程(`hardware thread`), 在一个多核处理器中，每个核心可以有一个或多个`hart`。每个 hart 在系统中都有一个唯一的标识符，称为 hart ID。在`RISC-V`架构中，可以通过读取特定的`CSR(Control and Status Register)`来获取当前执行的`hart`的`ID`，通常是`mhartid`寄存器。

![hart](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405152046139.png)
