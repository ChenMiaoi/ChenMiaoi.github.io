---
title: 'ArkTS: analyze riscv64 assember'
mathjax: true
date: 2024-07-16 19:42:50
tags: [arkts, ospp]
categories: [arkts]
---

# ArkTS RISC-V64 Assembler

在这一节中，我们会主要分析`ArkTS`中的`RISC-V`架构的汇编，这也是我们的主要目标之一。当前分析的版本位于[ArkTS Runtime](https://gitee.com/riscv-sig/arkcompiler_ets_runtime/tree/weekly_20230905/)[commit 2d8e197]。

## RISC-V64 Detail

在开始分析实际代码前，我们需要了解一点`RISC-V`的相关知识。`RISC-V`是一种`RISC`架构的汇编语言，因此和`CISC`相比，其汇编更加精简。在`RISC-V`中主要把汇编分为了几种对应的类型，如下所示：

![RISCV I format](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407180955152.png)

在基础的`RV32I`指令集中，如上图所示，有四种主要的指令格式(`R`/`I`/`S`/`U`)。在这里，**所有的指令集的长度都被固定为$32-bits$，并且基础指令集是$IALIGN=32$的吗，这就意味着内存中的指令集必须以四字节对齐**。如果目标地址没有按$IALIGN$位对齐，则在获取的分支或无条件跳转上生成指令地址不对齐异常。该异常报告在分支或跳转指令上，而不是在目标指令上。对于未采用的条件分支，不会生成指令地址不对齐异常。

`RISC-V`**指令集架构在所有格式中都保持源寄存器(`rs1`和`rs2`)和目标寄存器(`rd`)处于相同位置，以简化解码。除了用于`CSR`指令的`5`位立即数外，立即数总是符号扩展的，并且通常打包到指令中最左边的可用位，这样分配是为了减少硬件复杂性。特别是，所有立即数的符号位总是位于指令的第`31`位，以加快符号扩展电路的速度**。

除了上面的四种主要指令格式之外，基础指令集还提供了关于`B`和`J`指令格式的变种：

![RISCV I format variant](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181004346.png)

`S`格式和`B`格式之间的唯一区别在于，`B`**格式中`12`位立即数字段用于以`2`的倍数编码分支偏移。通常做法是在硬件中将指令编码的立即数的所有位左移一位，而在这里，中间位(`imm[10:1]`)和符号位保持在固定位置，而`S`格式中的最低位(`inst[7]`)在`B`格式中编码为高位**。

### RV32

在`RISC-V`汇编中，单独分析一条汇编是繁琐的，因为`RISC-V`通常是一组汇编一起分析，通过对应的`funct code`和`opcode`就能够确定其具体为哪一条指令。

![RISCV opcode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181014022.png)

#### RV32-Immediate

![RV32 Immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181022943.png)

`ADDI`指令将符号扩展的`12`位立即数加到寄存器`rs1`。算术溢出被忽略，结果仅保留低`XLEN`位。`ADDI rd, rs1, 0`用于实现汇编伪指令`MV rd, rs1`。

`SLTI`指令将值`1`写入寄存器`rd`，如果寄存器`rs1`小于符号扩展的立即数(两者都作为有符号数处理)，否则将`0`写入`rd`。`SLTIU`与`SLTI`类似，但将值作为无符号数进行比较(即，立即数首先符号扩展到$XLEN$位，然后作为无符号数处理)。注意，`SLTIU rd, rs1, 1`如果$rs1 = 0$则将`rd`置为`1`，否则置为`0`(汇编伪指令`SEQZ rd, rs`)。

`ANDI`, `ORI`, `XORI`是逻辑操作指令，对寄存器`rs1`和符号扩展的`12`位立即数执行按位与、或和异或操作，并将结果放入`rd`。注意，`XORI rd, rs1, -1`对寄存器`rs1`执行按位逻辑反转(汇编伪指令`NOT rd, rs`)。

![RV32 Immediate shift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181040556.png)

按常数进行移位的指令被编码为`I`型格式的特化形式。要移位的操作数在`rs1`中，移位量编码在`I`型立即数字段的低`5`位。右移的类型编码在第`30`位。`SLLI`是逻辑左移(零被移入低位)；`SRLI`是逻辑右移(零被移入高位)；`SRAI`是算术右移(原符号位被复制到空出的高位)。

![RV32 Immediate other](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181048420.png)

`LUI`用于构建`32`位常量，使用`U`型格式。`LUI`将`32`位`U`型立即数值放入目标寄存器`rd`中，最低的`12`位填充为零。

`AUIPC`用于构建相对于程序计数器(`pc`)的地址，使用`U`型格式。`AUIPC`形成一个`32`位偏移量，最低的`12`位填充为零，将此偏移量加到`AUIPC`指令的地址上，然后将结果放入寄存器`rd`中。

#### RV32-Register

`RV32I`定义了几种算术`R`型操作。所有操作都读取`rs1`和`rs2`寄存器作为源操作数，并将结果写入`rd`寄存器。`funct7`和`funct3`字段选择操作的类型。

![RV32 Register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181115880.png)

`ADD`执行`rs1`和`rs2`的加法。`SUB`执行`rs1`减去`rs2`的减法。溢出被忽略，结果的低$XLEN$位写入目标寄存器`rd`。`SLT`和`SLTU`分别执行有符号和无符号比较，如果$rs1 lt rs2$，则将`1`写入`rd`，否则写入`0`。注意，`SLTU rd, x0, rs2`如果$rs \ne 0$则将`rd`置为`1`，否则置为`0`(汇编伪指令`SNEZ rd, rs`)。`AND`、`OR`和`XOR`执行按位逻辑运算。

`SLL`、`SRL`和`SRA`分别对寄存器`rs1`中的值按寄存器`rs2`低`5`位中的移位量执行逻辑左移、逻辑右移和算术右移。

#### RV32-NOP

![RV32 NOP](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181422238.png)

`NOP`指令不会改变任何架构上可见的状态，除了推进程序计数器(pc)和增加任何适用的性能计数器。`NOP`被编码为`ADDI x0, x0, 0`。

#### RV32-Jump

`RV32I`提供了两种类型的控制转移指令：**无条件跳转和条件分支**。`RV32I`**中的控制转移指令没有架构上可见的延迟槽**。如果在跳转或已执行分支的目标上发生指令访问故障或指令页故障异常，则异常在目标指令上报告，而不是在跳转或分支指令上报告。

跳转并链接(`JAL`)指令使用`J`型格式，其中`J`型立即数编码为以`2`字节为单位的有符号偏移量。偏移量被符号扩展并加到跳转指令的地址上，以形成跳转目标地址。因此，跳转可以目标$±1 MiB$的范围。`JAL`将跳转后指令$pc+4$的地址存储到寄存器`rd`中。标准的软件调用约定使用`x1`作为返回地址寄存器，并使用`x5`作为备用链接寄存器。

普通无条件跳转(汇编伪指令`J`)被编码为$rd=x0$的`JAL`。

![JAL](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181447591.png)

间接跳转指令`JAL`(跳转并链接寄存器)使用`I`型编码。目标地址通过将符号扩展的`12`位`I`型立即数加到寄存器`rs1`上获得，然后将结果的最低有效位设为零。跳转后指令($pc+4$)的地址写入寄存器`rd`。如果不需要结果，可以使用寄存器`x0`作为目标寄存器。

![JALR](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181455224.png)

**如果目标地址未对齐到四字节边界, `JAL`和`JALR`指令将生成指令地址未对齐异常**。

**返回地址预测堆栈是高性能指令获取单元的常见特性，但需要准确检测用于过程调用和返回的指令才能有效**。对于`RISC-V`，指令使用的提示通过使用的寄存器编号隐式编码。仅当`JAL`指令的`rd`是`x1`或`x5`时，才应将返回地址推入返回地址堆栈(`RAS`)。`JALR`指令应根据下图所示推入/弹出`RAS`。

![Return-address stack Table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181500273.png)

#### RV32-Branch

所有分支指令都使用`B`型指令格式。`12`位`B`型立即数以`2`字节为单位编码有符号偏移量。偏移量被符号扩展并加到分支指令的地址上，以得出目标地址。条件分支范围为$±4 KiB$。

![Branch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181502814.png)

分支指令比较两个寄存器。`BEQ`和`BNE`分别在寄存器`rs1`和`rs2`相等或不等时执行分支。`BLT`和`BLTU`分别在使用有符号和无符号比较时$rs1 \lt rs2$时执行分支。`BGE`和`BGEU`分别在使用有符号和无符号比较时$rs1 \ge rs2$时执行分支。注意，`BGT`、`BGTU`、`BLE`和`BLEU`可以通过反转`BLT`、`BLTU`、`BGE`和`BGEU`的操作数来合成。

#### RV32-LoadStore

`RV32I`是一种`load-store`架构，其中只有加载和存储指令访问内存，算术指令只对`CPU`寄存器进行操作。`RV32I`提供一个`32`位的地址空间，以字节为单位寻址。`EEI`(执行环境接口)将定义哪些部分的地址空间可以使用哪些指令进行访问(例如，某些地址可能是只读的，或者只支持字访问)。即使目标寄存器是`x0`的加载操作，仍必须引发任何异常并引起其他副作用，即使加载的值被丢弃。

`EEI`将定义内存系统是小端序还是大端序。在`RISC-V`中，端序是字节地址不变的。

![RV32I load-store](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181512721.png)

加载和存储指令在寄存器和内存之间传输值。加载指令使用`I`型格式编码，存储指令使用`S`型格式。有效地址通过将寄存器`rs1`与符号扩展的`12`位偏移量相加获得。加载指令将内存中的值复制到寄存器`rd`。存储指令将寄存器`rs2`中的值复制到内存中。

`LW`指令将`32`位值从内存加载到`rd`中。`LH`从内存加载`16`位值，然后符号扩展到`32`位后存储在`rd`中。`LHU`从内存加载`16`位值，但随后零扩展到`32`位后存储在`rd`中。`LB`和`LBU`类似地定义为加载`8`位值。`SW`、`SH`和`SB`指令将`32`位、`16`位和`8`位值从寄存器`rs2`的低位存储到内存中。

#### RV32-Memory

![FENCE](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181539309.png)

`FENCE`指令用于对设备`I/O`和内存访问进行排序，使其在其他`RISC-V`处理器核(`hart`)和外部设备或协处理器看来有序。可以将设备输入(`I`)、设备输出(`O`)、内存读取(`R`)和内存写入(`W`)的任意组合相对于相同的任意组合进行排序。**非正式地说, `FENCE`之后的继承集合中的任何操作，在`FENCE`之前的前置集合中的任何操作完成之前，不能被其他`RISC-V`处理器核或外部设备观察到**。

`FENCE`**指令还对处理器核进行的内存读写操作相对于外部设备进行的内存读写操作进行排序。然而，`FENCE`不对外部设备使用任何其他信号机制进行的事件观察进行排序**。

`EEI`**将定义哪些`I/O`操作是可能的，特别是哪些内存地址在被加载和存储指令访问时将分别被视为设备输入和设备输出操作，而不是内存读写操作**。例如，通常使用未缓存的加载和存储访问内存映射的`I/O`设备，这些操作使用`I`和`O`位进行排序，而不是使用`R`和`W`位。指令集扩展可能还会描述新的`I/O`指令，这些指令也将使用`FENCE`中的`I`和`O`位进行排序。

![Fence mode encoding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181540312.png)

`fence`模式字段`fm`定义了`FENCE`指令的语义。$fm=0000$的`FENCE`指令在其继承集合中的所有内存操作之前排序其前置集合中的所有内存操作。

`FENCE.TSO`指令被编码为$fm=1000$、前置集合=`RW`、继承集合=`RW`的`FENCE`指令。`FENCE.TSO`指令在其前置集合中的所有加载操作之前排序其继承集合中的所有内存操作，并在其前置集合中的所有存储操作之前排序其继承集合中的所有存储操作。这使得`FENCE.TSO`的前置集合中的非`AMO`存储操作与其继承集合中的非`AMO`加载操作不排序。

#### RV32-Env

`SYSTEM`指令用于访问可能需要特权访问的系统功能，并使用`I`型指令格式编码。这些指令可以分为两大类：**atomically read-modify-write control**和**状态寄存器**(**CSR**)的指令，以及所有其他潜在的特权指令。`CSR`指令需要单独描述，基本的非特权指令在以下部分描述。

![SYSTEM](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181553919.png)

`ECALL`指令用于向执行环境发出服务请求。`EEI`将定义如何传递服务请求的参数，但通常这些参数将在整数寄存器文件中的指定位置。

`EBREAK`指令用于将控制权返回到调试环境。

### RV64

`RV64I`将整数寄存器和支持的用户地址空间扩展到`64`位($XLEN=64$)。

#### RV64-Immediate

大多数整数计算指令操作$XLEN$位值。在`RV64I`中提供了额外的指令变体，用于操作`32`位值，这些指令的操作码以 `W` 后缀表示。这些 `*W` 指令忽略输入的高`32`位，并始终生成`32`位有符号值，将它们符号扩展到`64`位，即位 $XLEN-1$ 到 `31` 是相等的。

![ADDIW](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181620677.png)

`ADDIW`是`RV64I`指令，将符号扩展的`12`位立即数加到寄存器`rs1`，并在`rd`中生成正确符号扩展的`32`位结果。溢出被忽略，结果是低`32`位的符号扩展到`64`位的结果。注意，`ADDIW rd, rs1, 0`将寄存器`rs1`的低`32`位的符号扩展写入寄存器`rd`(汇编伪指令 `SEXT.W`)。

![immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181631534.png)

常量移位指令使用与`RV32I`相同的指令操作码作为`I`型格式的特化。待移位的操作数在`rs1`中，移位量在`RV64I`的`I`型立即数字段的低`6`位中编码。右移类型在第`30`位中编码。`SLLI`是逻辑左移(零被移入低位)；`SRLI`是逻辑右移(零被移入高位)；`SRAI`是算术右移(原始符号位被复制到腾出的高位)。

![Shift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181633545.png)

`SLLIW`、`SRLIW` 和 `SRAIW` 是仅 `RV64I` 支持的指令，它们以类似的方式定义，但作用于 `32` 位值，并将其 `32` 位结果符号扩展到 `64` 位。$imm[5] \ne 0$ 的 `SLLIW`、`SRLIW` 和 `SRAIW` 编码是保留的。

![other](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181657447.png)

`LUI`使用与 `RV32I` 相同的操作码。`LUI` 将 `32` 位 `U` 型立即数放入寄存器 `rd`，并用零填充最低的 `12` 位。`32` 位结果被符号扩展到 `64` 位。

`AUIPC`使用与 `RV32I` 相同的操作码。`AUIPC` 用于构建相对于 `pc` 的地址，并使用 `U` 型格式。`AUIPC` 从 `U` 型立即数形成一个 `32` 位偏移量，填充最低的 `12` 位为零，将结果符号扩展到 `64` 位，将其加到 `AUIPC` 指令的地址，然后将结果放入寄存器 `rd`。

#### RV64-Register

![RV64 Register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181700821.png)

`ADDW` 和 `SUBW` 是仅 `RV64I` 支持的指令，定义类似于 `ADD` 和 `SUB`，但作用于 `32` 位值并生成有符号的 `32` 位结果。溢出被忽略，结果的低 `32` 位被符号扩展到 `64` 位并写入目标寄存器。

`SLL`、`SRL` 和 `SRA` 对寄存器 `rs1` 中的值执行逻辑左移、逻辑右移和算术右移，移位量由寄存器 `rs2` 中的值决定。在 `RV64I` 中，仅考虑 `rs2` 的低 `6` 位作为移位量。

`SLLW`、`SRLW` 和 `SRAW` 是仅 `RV64I` 支持的指令，定义类似，但作用于 `32` 位值并将其 `32` 位结果符号扩展到 `64` 位。移位量由 `rs2[4:0]` 给出。

#### RV64-LoadStore

`RV64I` 将地址空间扩展到 `64` 位。执行环境将定义哪些部分的地址空间是合法访问的。

![Load Store](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181704209.png)

在 `RV64I` 中，`LD` 指令从内存中加载一个 `64` 位值到寄存器 `rd`。

在 `RV64I` 中，`LW` 指令从内存中加载一个 `32` 位值，并将其符号扩展到 `64` 位后存储到寄存器 `rd`。而 `LWU` 指令则将内存中的 `32` 位值零扩展到 `64` 位。同样，`LH` 和 `LHU` 对 `16` 位值的操作与此类似，`LB` 和 `LBU` 对 `8` 位值的操作也类似。`SD`、`SW`、`SH` 和 `SB` 指令分别将寄存器 `rs2` 的低位的 `64` 位、`32` 位、`16` 位和 `8` 位值存储到内存中。

### RV Instructions

![RV32 Instructions](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181712540.png)

![RV64 Instructions](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181714021.png)

