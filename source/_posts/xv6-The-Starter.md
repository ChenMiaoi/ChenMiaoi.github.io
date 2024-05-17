---
title: 'xv6: The Starter'
mathjax: true
date: 2024-05-16 02:44:23
tags: [xv6, os, risc-v]
categories: [xv6]
---

# XV6 Operator System: 02-The Starter

--- 

> 在上一节中，我们已经了解了`xv6-riscv`是如何从`qemu`中引导内核到指定入口点，并从该入口点进入转跳到特定`start`函数的。那么现在，我们就来解析`start`函数是如何工作的。

## Start Function

在开始之前，我们需要知道的是，在`start`函数中，**我们并未真正地进入内核**。这是什么意思呢？实际上就是，`start`**函数实际上还是属于引导程序的一部分，其最终的目的就是跳转到**`main`**函数中，从而进入内核态执行**。同时，有一个最浅显的概念是：`xv6-riscv`的内核态是运行在`S`态的，而非`M`态，因此，我们从入口点转跳到`start`函数中时，其仍是`M`态。也就是说，`start`**函数的另一个目的就是需要为进入**`main`**函数设置合适的环境配置**。

因此，这里就很自然的引出了一个问题：**如何从**`M`**态降入**`S`**态呢？**现在，我们来了解一些关于`risc-v privilege`的知识。

### mstatus csr(Machine Status Register)

`mstatus`寄存器是一个`MXLEN`位比特的可读写的寄存器，**其跟踪并控制了**`hart`**的当前运行状态**。也就是说，我们可以通过修改`mstatus`的一些特定位，来使得`hart`在当前的运行状态发生变化。下面给出了`rv32 mstatus`和`rv64 mstatus`的格式：

![risc-v32 mstatus](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161531613.png)

![risc-v64 mstatus](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161533069.png)

在这里，我**并不打算完整的将**`mstatus`**的所有标志位介绍完，只会介绍本节中我们将涉及到的标志位**。

全局中断使能标志位：`MIE`和`SIE`，分别用于`M-mode`和`S-mode`。这些位主要被用于确保当前特权级模式下的中断处理程序的原子性，也就是说：**设置**`xIE`**以处理**`M`**态或**`S`**态中断。并且，允许被一个单独的**`csr`**指令所设置**。 

当一个`hart`在$x$特权级下执行时，当$xIE = 1$时，全局启用中断；当$xIE = 0$时，全局关闭中断。对于低特权级的中断而言，如果$x \gt w$，那么不论低特权级设置了何种$wIE$，总是全局中断的；对于高特权级的中断而言，如果$y \ge x$，那么不论如何，总是全局开启的。如何理解呢：**如果从一个高特权级的视角看待低特权级，那么低特权级的中断设置对于高特权级没有任何影响；如果从低特权级的视角看待高特权级，那么高特权级总是启用的**。

也就是说，实际上的`riscv`特权级有着以下规定：**高特权级总是能够打断低特权级的**。同时，这里也给出了一个优势，**高特权级的代码能够使用单独的每个中断使能来禁用选定的高特权级中断，然后再将控制权转交给低特权级**。而回忆一下我们的目标，我们需要从`M`态转变到`S`态，而内核态是常驻于`S`态的，因此，**我们并不希望**`M`**态的中断被经常触发从而导致内核的任务被强行打断，使得效率变低**，因此，我们需要对中断位进行设置(在后续介绍)。

为了支持嵌套`trap`，每一个能够响应中断的特权级模式$x$都有一个包含中断使能位和特权级模式的两级栈。$xPIE$**保存了**`trap`**发生之前激活的中断使能位的值，而$xPP$保存了上一个特权级模式**。

> Two-level Stack  
> 两级栈指的是有两个层次的栈结构，用于存储中断使能位和特权模式。第一级存储当前的中断使能位和特权模式，第二级存储在处理中断时被保存的中断使能位和特权模式。

$xPP$字段最多只能包含$x$个特权级模式，因此，`MPP`有两个比特的位宽，而`SPP`只有一位。当`trap`从特权级模式$y$进入到特权级$x$时，$xPIE$被设置为$xIE$的值，而$xIE$将会被置零，与此同时，$xPP = y$。

**对于低特权级而言，任何**`trap`(**同步或异步的**)**通常在进入时以*中断禁用的状态*进入更高特权级模式。高特权级的**`trap`**处理程序将处理该**`trap`**并使用堆栈信息返回，或者，如果不立即返回到中断的上下文，将在重新启动中断之前保存特权级堆栈，因此每个堆栈只需要一个入口**。

到现在我们就还剩一个问题，高特权级是如何返回到低特权级的呢？

`MRET`或`SRET`指令解决了这一个疑问，`MRET`或`SRET`分别被用于从一个处于`M`态或`S`态的`trap`中返回。假设$xPP = y，当执行一条$xRET$指令时，那么$xIE = xPIE$，特权级模式被设置为$y$，$xPIE = 1$，$xPP$将被设置为最低特权级模式(`U mode`, 如果`U`未被实现，则设置为`M`)。并且，如果$y \ne M \rightarrow MPRV = 0$。

这里简单的解释一下上面这句话的含义：当`xRET`指令执行时，保存着上一特权级信息的`xPIE`和`xPP`就会起效，`xPIE`在赋值完成后，将被设置为`1`，这是因为**高特权级的中断总是启用的**。而`MPRV`表示内存访问的特权模式。如果返回的特权模式`y`不是`M`，则将`MPRV`置为`0`。这意味着内存访问将不再使用`M mode`，而是使用当前的特权模式。

比较难以理解的是，为什么`xPP`会被设置为最低特权级模式。设置`xPP`为最低特权级模式**有助于识别在两级特权级栈管理中的软件错误**。

值得注意的是，`xPP`字段是`WARL`类型字段，**其只能包含**$x$**特权级模式或任何实现的低于**$x$**的特权级模式**。**如果特权级模式**$x$**未被实现**，**那么$xPP$字段必须被设置为只读的**$0$。

> WARL(Write Any Values, Reads Legal Values)  
> 某些读/写`CSR`字段仅在特定的比特编码子集中定义，但允许写入任何值，同时保证在读取时返回一个合法值。假设写入`CSR`没有其他副作用，可以通过尝试写入一个期望的设置，然后读取以查看该值是否被保留，从而确定支持的值范围。这些字段在寄存器描述中标记为`WARL(Write-Any Read-Legal)`。  
> 实现不会因为向`WARL`字段写入不支持的值而引发异常。当读取一个`WARL`字段时，如果上一次写入的是一个非法值，实现可以返回任何合法值，但返回的合法值应当与写入的非法值以及`hart`的架构状态有确定性的关系。

### mepc csr(Machine Exception Program Counter)

在这里，我并不会详细介绍`mepc`的所有用法，只会提及一点：**当**`start`**函数调用**`mret`**时**, `mepc`**的值应该被设置为**`main`**函数的地址**。

这里可以给出一个比较正式的用法：当`trap`进入`M`态时，`mepc`会被写入引发中断或遇到异常的指令的虚拟地址。因此，在`mret`调用时，会根据`mepc`的值进行跳转。

![mepc](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161703495.png)

### satp(Supervisor Address Translation and Protection Register)

`satp`寄存器是一个`SXLEN`位宽的读写寄存器，其控制了`S`模式下的地址转换和保护。`satp`有两种形式，分别为$SXLEN = 31$或$SXLEN = 64$：

![SXLEN = 32](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161825930.png)

![SXLEN = 64](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161826849.png)

`satp`寄存器包含一个根页表的物理页码(`PPN, Physical Page Number`)，该物理页码是由`S mode`的物理地址除以$4 KiB$而来；一个地址空间标识符(`ASID, Address Space Identify`)，该标识符有助于在每个地址空间执行地址转换屏障(`fence`)；以及一个模式(`MODE`)字段，其决定了当前地址的转换方法。

其中，对于`MODE`字段我们需要详细介绍一下。当$MODE = Bare$时，`S`特权级的虚拟地址直接等价于物理地址，除了物理内存保护方案外没有其他额外的内存保护。为了选择$MODE = Bare$，软件**必须**将`satp`的**剩余字段置零**。**试图在$MODE = Bare$的情况下使用一个非零的**`satp`**将对未置零的字段的值会产生一个**`UNSPECIFIED(未指明的)`**影响，并对地址转换和保护行为产生一个**`UNSPECIFIED`**影响**。

对于$SXLEN = 32$时，`MODE`的唯一一个有效设置为`Sv32`，一种虚拟内存分页策略。当$SXLEN = 64$时，一共有三种虚拟内存分页策略可供选择：`Sv39`、`Sv48`和`Sv57`。其余的`MODE`设置保留以供将来使用，并且可以定义`satp`中其他字段的不同解释。

![satp mode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161850259.png)

`satp`**寄存器在**`S mode`和`U mode`**下才被认为是激活状态**。地址转换算法只可能在`satp`被激活时使用一个给定的`satp`值开始执行。

### medeleg & mideleg csr(Machine Trap Delegation Registers)

**在默认情况下，任何特权级的所有**`trap`**都是在**`M mode`**被处理的，不过**`M mode`**的处理程序可以使用**`MRET`**指令将**`trap`**重定向到合适的特权级**。

为了提高性能，具体实现可以在`medeleg`和`mideleg`中通过提供单独的读写位来表明一些特定的异常和中断应该被低特权级直接处理。`medeleg(machine exception delegation)`是一个$64$位宽的读写寄存器；而`mideleg(machine interrupt delegation)`是一个`MXLEN`位宽的读写寄存器。

![medeleg](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161903945.png)

![mideleg](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161904480.png)

在`S mode`下的`hart`中，`medeleg`和`mideleg`**必须存在，并且在**`S mode`或`U mode`**下发生对应的**`trap`**时，在**`medeleg`或`mideleg`**中设置一位把该**`trap`**委托给**`S mode`**下的**`trap handler`。

当一个`trap`被委托给`S mode`时，会执行以下操作:

- `scause`寄存器写入`trap`的原因
- `sepc`寄存器写入引发`trap`的指令的虚拟地址
- `stval`寄存器写入特定于异常的数据
- `mstatus`寄存器中的`SPP`字段写入发生`trap`时激活的特权级模式
- `mstatus`寄存器中的`SPIE`字段写入发生`trap`时的`SIE`字段的值
- `mstatus.SIE`字段置零
- `mcause`、`mepc`、`mtval`以及`mstatus.MPP`和`mstatus.MPIE`字段不会被写入

值得注意的是：`trap`**永远不会从更高特权级转换到更低特权级，这一情况不会发生**。只可能在水平上进行发生，也就是：如果`M mode`委托了一个`trap`到`S mode`，那么引发异常的`trap`能够在`S mode`下进行处理。

### Supervisor Interrupt Registers(sip and sie)

在本节中，并不会对`sip`寄存器做出介绍，因为这里的重点是`sie`寄存器。

`sie`寄存器是一个$SXLEN$位宽的读写寄存器，其包含了中断使能位。中断原因号与`sie`的位号相对应。比特`15:0`只分配给标准中断原因，而比特`16`及以上被指定为平台使用。

![sie](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929965.png)

![scause values](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929250.png)

![sie portion](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161931972.png)

- `sie.SSIE`是用于`S mode`外部中断的中断使能位
- `sie.STIP`是用于`S mode`时钟中断的中断使能位
- `sie.SEIE`是用于`S mode`软件中断的中断使能位
- 如果实现了`Sscofpmf`扩展，`sie.LCOFIE`是本地计数器溢出中断的中断使能位。如果未实现该扩展，`sie.LCOFIE`则是只读的`0`

### Physical Memory Protection CSRs

在这里只介绍两个寄存器：`pmpcfg0`和`pmpaddr0`。

`PMP(物理内存保护)`条目由一个`8`位的配置寄存器和一个`MXLEN`位的地址寄存器描述。一些`PMP`设置还会使用与前一个`PMP`条目相关联的地址寄存器。最多支持`64`个`PMP`条目。实现中可以实现`0`个、`16`个或`64`个`PMP`条目；**必须首先实现编号最低的**`PMP`**条目**。所有`PMP CSR`字段都是`WARL`，并且可能是只读零。`PMP CSR`**仅在**`M mode`**下可访问**。

`PMP configuration`寄存器被密集地打包到`CSRs`中，**以最小化上下文切换时间**。对于`RV32`，有十六个`CSRs(pmpcfg0–pmpcfg15)`，用于保存`64`个`PMP`条目的配置`(pmp0cfg–pmp63cfg)`。对于`RV64`，有八个偶数编号的`CSRs(pmpcfg0、pmpcfg2、……、pmpcfg14)`，用于保存`64`个`PMP`条目的配置。对于`RV64`，**奇数编号的配置寄存器**`(pmpcfg1、pmpcfg3、……、pmpcfg15)`**是非法的**。

![rv32 pmp configuration](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161949274.png)

![rv64 pmp configuration](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161950438.png)

`PMP address`寄存器是命名为`pmpaddr0-pmpaddr63`的`CSRs`。每个`PMP address`寄存器在`RV32`中编码一个`34`位物理地址的第`33`到第`2`位。对于`RV64`，每个`PMP address`寄存器编码一个`56`位物理地址的第`55`到第`2`位。**并非所有物理地址位都需要实现**，因此`pmpaddr`寄存器是`WARL`的。

![rv32 pmp address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161954317.png)

![rv64 pmp address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161954318.png)

下图显示了`PMP configuration`寄存器的布局。`R`、`W`和`X`位分别表示`PMP`条目允许**读**、**写**和**指令执行**。**当其中某一位被清除时，相应的访问类型被拒绝**。`R`、`W`和`X`字段组成一个集体的`WARL`字段，其中$R = 0$和$W = 1$的组合是保留的。其余两个字段`A`和`L`在后续章节中描述。

![pmp configuration layout](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161957353.png)

### Start Code

至此，关于理解`start`函数逻辑的前置知识就介绍完毕。现在就让我们来分析`start`函数中的具体内容：

```c
#define MSTATUS_MPP_MASK (3L << 11)
#define MSTATUS_MPP_S (1L << 11)
r_mstatus => asm volatile("csrr %0, mstatus" : "=r"(x));
r_mstatus => asm volatile("csrw mstatus, %0" : : "r"(x));

unsigned long x = r_mstatus();
x &= ~MSTATUS_MPP_MASK;
x |= MSTATUS_MPP_S;
w_mstatus(x);
```

这是从入口点`_entry`到`start`函数的第一个操作，我们在之前已经知道：`start`函数最终目的是要转跳到`main`函数中，并在此之前进行一系列配置，然后进入内核态。那么，`xv6-riscv`的内核态是运行在`S mode`的，而从`_entry`进入到`start`的此时，是处于`M mode`的。因此，我们需要设置进入`main`函数后的特权级。

而`r_mstatus`便是读取当前`hart`的运行状态，而`x &= ~MSTATUS_MPP_MASK`对`mstatus.MPP`进行置零操作，然后通过`x |= MSTATUS_MPP_S`设置`mstatus.MPP = S`。这样，我们就能够在`mret`指令后，将特权级设置为`S`。

但是，我们发现：**我们现在只完成了设置特权级，但是并未设置到底要转跳到哪一个位置**。因此：

```c
w_mepc((uint64)main);
```

在上面我们已经了解了，`mret`的返回地址是根据`mepc`寄存器而决定的，因此我们将`mepc`的值设置为`main`函数的地址，就能够在`mret`执行的时候转跳到对应的`main`函数从而进入内核态。

这样，我们就完成了一个简易的内核态的入口，但是，对于一个`xcv6-riscv`来说，还需要进行一些具体的处理：

```c
// disable paging for now.
w_satp(0);

// delegate all interrupts and exceptions to supervisor mode.
w_medeleg(0xffff);
w_mideleg(0xffff);
w_sie(r_sie() | SIE_SEIE | SIE_STIE | SIE_SSIE);

// configure Physical Memory Protection to give supervisor mode
// access to all of physical memory.
w_pmpaddr0(0x3fffffffffffffull);
w_pmpcfg0(0xf);

// ask for clock interrupts.
timerinit();

// keep each CPU's hartid in its tp register, for cpuid().
int id = r_mhartid();
w_tp(id);
```

让我们来逐行分析这些代码的含义：

我们知道`satp`寄存器用于管理页表基地址、地址空间标识符以及启动或禁用分页机制。简单思考一下，**操作系统初始化早期，我们并不需要启动太多的事项，而且由于有一些需要直接访问物理内存进行配置，如果启动分页机制，就需要进行页表转换，那么我们在初始化阶段就需要浪费一定的资源来额外的进行初始化操作**。我们在这里设置$satp = 0$是为了简化内存管理，并且不需要过早的进行分页管理，等到进入内核态后，再启用分页机制支持虚拟内存。

`medeleg`和`mideleg`是为了提高效率，因为频繁的通过`M mode`来处理`trap`会极大的影响内核的运行。因此，在此处，我们直接将所有的异常和中断都委托给了`S mode`来处理，也就是说，内核态对`trap`具有全部的处理能力，这也符合一般认知，内核会处理用户的异常和中断，而不是交由`M mode`。

现在我们已经将`trap`的处理权交付给了`S mode`，但是我们需要显示开启`S`特权级下的中断使能，因此`w_sie(r_sie() | SIE_SEIE | SIE_STIE | SIE_SSIE)`便是**允许内核态对外部中断、时钟中断和软件中断的响应**。这也对应了上面`M mode`将`trap`的处理全权委托给了内核态。

当我们有了处理权限后，我们就可以考虑内存访问了，在[上一节](https://chenmiaoi.github.io/2024/05/15/xv6-The-boot-loader/)中，我们了解到`xv6-riscv`的内存布局，而其物理地址是$56$位宽的，因此`w_pmpaddr0(0x3fffffffffffffull)`将`PMP`的第一个条目的地址寄存器设置为`0x3fffffffffffff`，刚好覆盖了整个物理地址空间，因此该条目可以匹配任何物理地址。而`w_pmpcfg0(0xf)`则是对该条目进行具体配置，允许了`S mode`**对整个物理地址具有读、写和执行访问权限**。

而`timerinit()`则是设置了时钟中断源，使得`xv6-riscv`能够获得时间片。

而最后一点，便是获取当前`hart`的`ID`，写入`tp`寄存器。`tp`寄存器用于存储线程指针，即当前执行流`ID`。

## Timer

### CLINT

在`risc-v`中，`CLINT`的定义是由平台具体实现的，而`qemu virt`参考了`SIFIVE`的`CLINT`设计。因此，在这里我参考了`SiFive FE310-G000`型号的开发板进行分析。

`xv6-riscv`的`CLINT`是根据[qemu virt](https://github.com/qemu/qemu/blob/master/hw/riscv/virt.c)中的设置而来，因此可以看见`CLINT`的基址位于`0x2000'0000`处。

```c
static const MemMapEntry virt_memmap[] = {
    [VIRT_CLINT] =        {  0x2000000,       0x10000 },
};
```

了解到`CLINT`在实际物理地址中的基址后，我们就需要学习关于`CLINT`的一些基本概念:

`CLINT(Core Local Interruptor)`是一个处理器内部模块，**负责处理和管理核本地的中断和定时器功能**。`CLINT`的主要功能包括:

- `本地中断管理(Local Interrupt Management)`：`CLINT`处理核本地的中断请求，这些中断请求通常不需要通过全局中断控制器(如`PLIC，Platform-Level Interrupt Controller`)进行处理。`CLINT`**管理的中断通常是核内的特殊事件**，例如软件中断和定时器中断。
- `定时器功能(Timer Functionality)`：`CLINT`**提供核本地的定时器功能，用于生成周期性中断**。每个处理器核都有一个独立的定时器，通过编程可以设置定时器的触发时间。**当定时器到达设定时间时，会触发一个中断，处理器核可以用这个中断来执行周期性任务或进行时间管理**。

在`risc-v`中，操作`CLINT`是有着专属寄存器的：

- `msip(Machine-mode Software Interrupt Pending Register)`：用于管理软件中断。每个核都有各自的`msip`寄存器。写入这个寄存器会触发相应核的机器模式软件中断(`Machine Software Interrupt`)
- `mtime(Machine Timer Register)：这是一个64位的计时器寄存器，**用于跟踪时间**。**它通常由一个全局的、统一递增的计时器硬件单元提供时间戳**
- `mtimecmp(Machine Timer Compare Register)`：每个处理器核都有一个独立的$64$位`mtimecmp`寄存器。处理器核会不断地比较`mtime`和`mtimecmp`的值，当`mtime`达到或超过`mtimecmp`的值时，会触发机器模式定时器中断(`Machine Timer Interrupt`)

对于`CLINT`的专属寄存器，`risc-v`手册中并未给出详细定义地址，因此，我们参考`SiFive FE310-G000`能够得到其在物理地址中的映射地址：

![CLINT register remap](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171437088.png)

```c
// core local interruptor (CLINT), which contains the timer.
#define CLINT 0x2000000L
#define CLINT_MTIMECMP(hartid) (CLINT + 0x4000 + 8 * (hartid))
#define CLINT_MTIME (CLINT + 0xBFF8) // cycles since boot.
```

- `CLINT`：`CLINT`的基址，即`CLINT`寄存器的起始地址。
- `CLINT_MTIMECMP(hartid)`：用于计算给定`hartid`的`MTIMECMP`寄存器的地址。在`CLINT`中，每个`hart`都有一个`MTIMECMP`寄存器，用于设置定时器中断触发的时间比较值。
- `CLINT_MTIME`：用于访问`MTIME`寄存器的地址。`MTIME`寄存器用于跟踪自启动以来的时钟周期数，它通常用于实现定时器。

在正式介绍`Timer`的代码前，我们需要对一些寄存器做出了解。

### mscratch csr(Machine Scratch Register)

`mscratch`寄存器是一个$MXLEN$位宽的读写寄存器，**其只能被**`M mode`**所使用**。**通常，它用于保存指向**`M mode`的`hart-local`**上下文空间的指针，并在进入**`M mode trap handler`**时与用户寄存器交换**。

当处理器进入机器模式处理中断或异常时，通常会使用`mscratch`寄存器保存上下文信息，例如保存当前的寄存器状态、程序计数器等。这样可以在处理完中断或异常后恢复处理器状态。

### mtvec csr(Machine Trap-Vector Base-Address Register)

`mtvec`寄存器是一个$MXLEN$位宽的读写寄存器，**其保存了由一个向量基址**(`Vector Base Address`)**和向量模式**(`Vector Mode`)**组成的**`trap vector configuration`。

![mtvec](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171455924.png)

`mtvec`总是被实现的，至少会包含一个可读的值；如果`mtvec`以可写的方式实现，那么`mtvec`所保存的值的集合根据实现的不同而不同。`mtvec.BASE`的值必须始终是四字节对齐的，而`mtvec.MODE`设置的值可能会对`mtvec.BASE`施加额外的对齐操作。

![Encoding of mtvec MODE field](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171502892.png)

`mtvec.MODE`的编码如上所示。当$mtvec.MODE = Direct$时，所有进入到`M`态的`trap`都会导致`pc`被设置为`mtvec.BASE`字段中的值；当`mtvec.MODE = Vectored`时，所有进入到`M`态的**同步异常**都会导致`pc`被设置为`mtvec.BASE`字段中的值，而所有进入到`M`态的**异步中断**都会导致`pc`被设置为$mtvec.BASE + cause \times 4$。

### Supervisor Interrupt Registers(sip and sie)

我们在介绍`start`函数时，曾介绍过`sie`寄存器。现在，我们对`sip`寄存器做出介绍。

`sip`寄存器是一个$SXLEN$位宽的读写寄存器，**其包含了挂起的中断的信息**。

![sip](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171514872.png)

![scause values](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929250.png)

![sip portion](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171519208.png)

- `sip.SEIP`用于`S`态的外部中断的中断挂起，如果实现，`SEIP`在`sip`中是**只读**的，并且由执行环境设置和清除，通常通过特定于平台的中断控件
- `sip.STIP`用于`S`态的定时器中断的中断挂起，如果实现，`STIP`在`sip`中是**只读**的，并且由执行环境设置和清除
- `sip.SSIP`用于`S`态的软件中断的中断挂起，如果实现，`SSIP`在`sip`中是**可写**的，并且可能被平台特定的中断控制器置`1`

### Timer Code

#### Timer Init

```c 
// a scratch area per CPU for machine-mode timer interrupts.
uint64 timer_scratch[NCPU][5];

void timerinit() {
  // each CPU has a separate source of timer interrupts.
  int id = r_mhartid();

  // ask the CLINT for a timer interrupt.
  int interval = 1000000; // cycles; about 1/10th second in qemu.
  *(uint64 *)CLINT_MTIMECMP(id) = *(uint64 *)CLINT_MTIME + interval;

  // prepare information in scratch[] for timervec.
  // scratch[0..2] : space for timervec to save registers.
  // scratch[3] : address of CLINT MTIMECMP register.
  // scratch[4] : desired interval (in cycles) between timer interrupts.
  uint64 *scratch = &timer_scratch[id][0];
  scratch[3] = CLINT_MTIMECMP(id);
  scratch[4] = interval;
  w_mscratch((uint64)scratch);

  // set the machine-mode trap handler.
  w_mtvec((uint64)timervec);

  // enable machine-mode interrupts.
  w_mstatus(r_mstatus() | MSTATUS_MIE);

  // enable machine-mode timer interrupts.
  w_mie(r_mie() | MIE_MTIE);
}
```

让我们来逐行分析上述代码：首先，获取当前的`hartid`，以便于后续计算`CLINT`的相关信息；

然后`*(uint64 *)CLINT_MTIMECMP(id) = *(uint64 *)CLINT_MTIME + interval`: 在`CLINT`中设置一个定时器中断。这行代码将`CLINT`的`MTIMECMP`寄存器(**用于设置定时器中断触发的时间比较值**)的值设置为当前的`MTIME`寄存器值加上一个指定的间隔。在这里，间隔为$100'0000$个`CPU`周期，大约相当于`qemu`中的$1/10$秒。

`uint64 *scratch = &timer_scratch[id][0]`: 创建一个指向`timer_scratch`数组的指针，并将其设置为当前`hart`对应的上下文的地址。这个数组用于存储一些与定时器中断相关的信息。

`scratch[3] = CLINT_MTIMECMP(id)`: 将`CLINT`的`MTIMECMP`寄存器的地址存储在`scratch`数组的第`3`个条目中。

`scratch[4] = interval`: 将定时器中断触发的时间间隔(以`CPU`周期数表示)存储在`scratch`数组的第`4`个条目中

`w_mscratch((uint64)scratch)`: 将`scratch`数组的地址存储在`MSRATCH`寄存器中，以便后续的处理，这里实际上就是对定时器中断的信息进行了初始化，保存在了当前`hart`的上下文中。

也就是说，在`timer init`中，我们创建了一个针对于每一个`hart`单独的定时器的上下文配置，具体如下所示：

```c
timer scratch[5] = {
    0,  reserve for parameters 
    8,  reserve for parameters 
    16, reserve for parameters 
    24, address of CLINT MTIMECMP register
    32, desired interval (in cycles) between timer interrupts
}
```

`w_mtvec((uint64)timervec)`: 将`M mode trap`向量基址寄存器(`MTVEC`)设置为`timervec`函数的地址。这意味着当发生`M mode`的`trap`时，处理器将跳转到`timervec`函数中执行相应的处理，而对于定时器中断，我们将其设置为`M mode trap handler`，因此只要发生定时器中断，那么就可以跳转到`timervec`中进行处理。

`w_mstatus(r_mstatus() | MSTATUS_MIE)`: 使能`M mode`中断(`MIE`)。这行代码将`MSTATUS`寄存器的`MIE`位设置为`1`，允许`M mode`中断。

`w_mie(r_mie() | MIE_MTIE)`: 使能机器模式的定时器中断(`MTIE`)。这行代码将`MIE`寄存器的`MTIE`位设置为`1`，允许机器模式的定时器中断，这里就与上述代码对应了。

#### Time Interrupt Handler

实际上，我认为在这里将`Timer Trap Handler`不是太合适，因此此处仅仅列出代码，并不做任何解释。

```asm
.globl timervec
.align 4
timervec:
        csrrw a0, mscratch, a0
        sd a1, 0(a0)
        sd a2, 8(a0)
        sd a3, 16(a0)

        # schedule the next timer interrupt
        # by adding interval to mtimecmp.
        ld a1, 24(a0) # CLINT_MTIMECMP(hart)
        ld a2, 32(a0) # interval
        ld a3, 0(a1)
        add a3, a3, a2
        sd a3, 0(a1)

        # arrange for a supervisor software interrupt
        # after this handler returns.
        li a1, 2
        csrw sip, a1

        ld a3, 16(a0)
        ld a2, 8(a0)
        ld a1, 0(a0)
        csrrw a0, mscratch, a0

        mret
```

最后，所有的准备工作完成后，我们就能够正式进入内核态进行各种初始化配置和运行了。