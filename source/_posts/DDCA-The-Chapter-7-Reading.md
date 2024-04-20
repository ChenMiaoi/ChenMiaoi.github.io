---
title: 'DDCA: The Chapter 7 Reading'
mathjax: true
date: 2024-04-20 14:18:10
tags: [ysyx, digital, logic, pipeline, architecture]
categories: [books]
---

# Micro-architecture

在本篇笔记中，我们为`MIPS`处理器架构开发了三种微体系结构：单周期、多周期和流水线。

## Single-Cycle Processor

我们首先介绍一个在单周期内执行指令的`MIPS`微体系结构。我们将下图中的状态元素与可执行各种指令的组合逻辑连接，开始构建数据通路。**控制信号决定了数据通路在任意给定时刻执行何种特定指令；控制器包含组合逻辑，根据当前指令产生合适的控制信号**。

![State element of MIPS processor](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201429220.png)

### Single-Cycle Datapath

本节逐步地开发一个单周期数据通路，每次在上图的基础上在状态元素间添加一个小片段。新添加的以黑色(或蓝色)的标识以强调，而已经研究过的硬件部分以灰色部分展示。

程序计数器寄存器(`PC`)包含了将要执行指令的地址。第一步是从指令存储器中读出指令，下图简单地展示了`PC`连接指令存储器的地址输入。指令存储器读出(或`抓取(fetch)`)一条$32-bits$的指令，标记为`Instr`。

![fetch instruction from memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201443500.png)

处理器的行为取决于被获取的特殊指令。首先，我们将计算出`lw`指令的数据通路；然后，我们就需要考虑如何泛化该数据通路到其余指令。

对于一条`lw`指令，下一步就是读取包含基址的源寄存器。这个寄存器在指令$Instr_{25:21}$处的`rs`字段中指定。指令的这些位连接到其中一个`regfile`模块中读取端口`A1`的地址输入，如下图所示。$regfile$将寄存器的值读取到`rd1`上

![regfile](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201449462.png)

`lw`指令也要求一个`offset`。这个偏移被存储在指令$Instr_{15:0}$的`immediate`字段。因为$16-bits$的立即数可能是正数或负数，因此我们必须把其符号扩展到$32-bits$，如上图所示。$32-bits$符号扩展数被称为$SignImm$。

处理器必须将基址和偏移地址相加才能得到真正从内存中读出的数据的地址。下图介绍了`ALU`来执行这一操作。$ALU$接收两个操作数，$SrcA$和$SrcB$；$SrcA$从`refile`中得到，而$SrcB$就是符号扩展的立即数。$3-bits \ ALUControl$信号代指了各种操作，而$ALU$会生成一个$32bits$的$ALUResult$和一个$Zero$标志。对于`lw`指令来说，$ALUControl$信号应该被设置为`010`来相加基址和偏移地址。$ALUResult$被发送到数据内存中，作为加载指令的地址，如下图所示。

![compute memory address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201522987.png)

从数据存储器中读出的数据会被送往`ReadData`总线中，然后在一个周期的最后回写到`regfile`中的目的寄存器中，如下图所示。

![write data back to register file](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201526440.png)

`lw`指令的目的寄存器被特指为`rd`字段，$Instr_{20:16}$被连接到`regfile`的$A3$上。`ReadData`总线被连接到`regfile`上的$WD3$上。被称为`RegWrite`的控制信号被连接到$WE3$上，同时其也是`lw`指令是否导通的标志，使得数据能够被写入`regfile`。

当指令被执行后，处理器必须计算下一条指令的地址$PC'$。因为指令是$32bits = 4 bytes$的，因此下一条指令是$PC + 4$。下图中使用了另一个加法器来使得$PC$增加。新的地址在下一个上升沿上被写入到程序计数器中。至此，`lw`的数据通路就完成了。

![determine address of next](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201535839.png)

下一步，让我们来扩展这个数据通路以处理`sw`指令。就像`lw`一样，`sw`指令读一个基址从`regfile`和符号扩展的立即数中。 `sw`指令也能读取第二个寄存器然后将其写入数据存储器中，如下图所示。该寄存器被称为`rt`，$Instr_{20:16}$，其被连接到`regfile`中的`A2`上。寄存器值被读取到`RD2`端口。然后连接到数据存储器上的`WD`接口上。

![write data to memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201957750.png)

对于数据存储器上，则多出一个`MemWrite`信号控制端口，用来判断是否应该写入，而`ALUControl = 010`则是执行基址与偏移地址相加的操作。现在，考虑扩展数据通路来处理`R-type`指令`add`、`sub`、`and`、`or`和`slt`。这些指令都是从`regfile`中读取两个寄存器，对其进行相应的操作后写回第三个寄存器。因此，这些指令都可以用相同的硬件、不同的`ALUControl`信号来处理。

下图展示了扩展后的数据通路：`regfile`读取两个寄存器，$ALU$执行不同的操作来进行处理。值得注意的是，之前的$SrcB$只接收一个$SignImm$作为输入，而现在应该需要使用多路选择器在$SignImm$和$RD2$中做出选择。同时，对于`lw`和`sw`而言，总是要经过数据存储器，但是对于`R-type`来说，在`ALU`得到的结果应该直接写回到`regfile`中。因此，我们在$ReadData$和$ALUResult$之间添加了一个多路选择器，这个多路选择器被一个新信号$MemtoReg$控制。

![enhanced datapath](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202005350.png)

在之前，`lw`和`sw`指令最终会写到`rt`，也就是$Instr_{20:16}$字段上；然而，对于`R-type`指令来说，应该写回`rd`，即$Instr_{15:11}$字段上。因此，我们添加第三个多路选择器来选择最终需要写回的寄存器是哪一个。该选择器被$RegDst$信号所控制。

最终，我们需要扩展数据通路来处理`beq`指令。`beq`比较两个寄存器是否相等，然后决定是否跳转。对于`beq`来说，跳转地址仍旧需要进行符号扩展，而新的地址应该是$PC' = PC + 4 + SignImm \times 4$。下图展示了数据通路的修改。我们新添一个$Branch$信号与$ALU$配合进行判断是否发生跳转，添加$PCBranch$来计算跳转的地址。

![datapath for beq](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202016781.png)

至此，我们就完成了单周期`MIPS`处理器的数据通路，下面就应该考虑如何计算控制信号来指导我们的数据通路的运行。

### Single-Cycle Control

控制单元根据`opcode`和`funct`，即$Instr_{31:26}$和$Instr_{5:0}$来计算控制信号。下图展示了整个单周期`MIPS`处理器的控制单元的连接情况。

![complete processor](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202022145.png)

对于`MIPS`指令集，大多数控制信息来自于`opcode`字段，但是`R-type`需要协同使用`funct`字段来决定`ALU`的执行类型。因此，我们通过将控制单元分解成两个逻辑组合块来简化涉及，如下图所示，主译码器计算来自`opcode`的大部分输出，还决定了一个$2bit$的`ALUOP`信号。`ALU`解码器根据`ALUOP`信号结合`funct`字段来计算`ALUControl`。

![control unit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202028296.png)

下表是`ALU`解码器的真值表以及主解码器的真值表：

![truth table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202031791.png)

### Performance Analysis

单周期处理器中每条指令都需要一个时钟周期，因此$CPI = 1$。`lw`指令的关键路径如下图所示，如蓝色虚线所示。其从`PC`开始，在时钟上升沿加载一个新地址，指令存储器读取下一条指令，`regfile`读取$SrcA$，并同时对立即数进行符号扩展，然后在多路选择器上进行选择，以确定$SrcB$。$ALU$计算这两个值以得到实际的有效地址，然后从数据存储器中的对应地址读出，$MemtoReg$多路复用器选择$ReadData$然后在下个周期上升沿之前写回`regfile`：

$$
    T_c = t_{pcq\_PC} + t_{mem} + max[t_{RFread}, t_{sext} + t_{mux}] + t_{ALU} + t_{mem} + t_{mux} + t_{RFsetup}
$$

![critical path for lw](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202034921.png)

在大多数实现中，`ALU`、存储器和`regfile`的访问速度明显慢于其余操作。因此，周期时间简化为：

$$
    T_c = t_{pcq\_PC} + 2t_{mem} + t_{RFread} + t_{ALU} + t_{RFsetup}
$$

## Multi-Cycle Processor

现在，我们以最开始的存储器和`regfile`开始。在单周期设计中，我们使用了单独的指令、数据存储器来读写指令数据。现在，我们选择同时使用指令和数据结合的存储器。

![state element](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202053459.png)

`PC`包含了执行指令的地址。第一步是从指令存储器中读取指令，下图展示了`PC`与指令存储器之间的连接。被读取的指令会存储在一个新的`Instruction Register`中，以便于其可以被未来的周期使用。这个指令寄存器接收一个使能信号$IRWrite$，当需要更新指令时，该信号导通。

![fetch inst](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202057254.png)

对于`lw`指令来说，下一步就是去读取包含基址的源寄存器`rs`，即$Instr+{25:21}$。然后该寄存器与`regfile`中的`A1`相连，读出对应数据后，通过`RD1`输出到一个寄存器`A`中。

![read source](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202103024.png)

当然，对于立即数，即$Instr_{15:0}$而言，仍旧需要进行符号扩展。因为立即数是指令的一个字段，在处理当前指令时指令自身不会发生变化，因此就不再需要额外的寄存器来保存立即数的值。

需要加载的地址由`ALU`计算得出，最终的结果会保存在名为`ALUOut`的寄存器中，如下所示：

![Add base](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202106374.png)

下一步就是根据计算的地址从存储器中取出数据。我们在存储器前添加一个多路选择器`Adr`来选择存储地址，多路选择器的选择信号被称为`IorD`，表明是指令地址还是数据地址。从存储器中读出的数据被存储在另一个寄存器`Data`中。注意，**复用器允许我们在**`lw`**指令期间能够重复使用内存：第一步，从$PC$中获取地址；然后地址取自**`ALUOut`**以加载数据**。因此，`IorD`在不同步骤上就必然有不同的取值，在后续会介绍。

![load data](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202108650.png)

最终，数据被写回`regfile`：

![write data back](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202114951.png)

当这些操作都发生后，处理器必须更新程序计数器。在单周期处理器中，单独的加法器足以完成。但在多周期处理器中，我们可以在上述步骤空闲时使用`ALU`。因此，我们必须在`ALU`的两个输入源处插入多路选择器，以使得$SrcA = PC, SrcB = 4$。而`PCWrite`信号使得`PC`寄存器仅在某些周期上被写入。

![increment PC](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202118050.png)

这样，我们就完成了`lw`指令的数据通路。现在，扩展数据通路以处理`sw`指令。对于`sw`来说，在电路中的变化就只是从`regfile`读出时存入寄存器，然后从寄存器中写入内存即可。然后在存储器上新增一个控制信号`MemWrite`，表示允许数据写入。

![datapath for sw](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202122377.png)

对于`R-type`而言，两个源寄存器的读取和上述一致，对于寄存器$B$的数据需要在$SrcB$时通过$ALUSrcB_{1:0}$进行选择，在回写阶段时，`ALUOut`的值应该被`MemtoReg`信号选择是`R-type`还是`lw`的数据，也要通过$RegDst$信号判断目的寄存器是`rd`还是`rt`。

![for R-type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202130883.png)

对于`beq`指令，在单周期时我们需要增加一个加法器和多路选择来进行计算；而在多周期，由于可以重复使用一个硬件资源，因此，我们重复利用`ALU`即可得到跳转地址。在其中一个步骤中，`ALU`会计算`PC + 4`并将结果写回`PC`寄存器中；因此，我们只需要在立即数到$SrcB$之间，对立即数进行左移操作，然后在将变化后的`PC`值与变化后的立即数值相加，写回`PC`寄存器即可得到跳转地址。

![complete multi](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202136801.png)

这样就完成了多周期`MIPS`处理器数据通路的设计。设计过程与单周期处理器非常相似，即系统地连接状态元素之间的硬件以处理每条指令。主要区别在于指令在多个步骤中执行。非体系结构寄存器被插入以保存每个步骤的结果。通过这种方式，ALU可以被多次重用，节省了额外加法器的成本。同样地，指令和数据可以存储在一个共享内存中。在下一节中，我们将开发一个FSM控制器，以在每个指令的每个步骤中向数据通路传递适当的控制信号序列。

### Multi-Cycle Control

和单周期一样，多周期也使用控制单元根据`opcode`和`funct`来计算控制信号，如下所示。

![complete multi-cycle](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202150698.png)

但是，和单周期简单的控制不同，多周期的主控制器是一个状态机，其在适当的周期或步骤上应用适当的控制信号。控制信号的顺序取决于正在执行的指令。

![control unit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202152218.png)

主控制器产生出多路复用器和寄存器使能信号，其选择信号为：`MemtoReg`、`RegDst`、`IorD`、`PCSrc`、`ALUSrcB`和`ALUSrcA`；使能信号为`IRWrite`、`MemWrite`、`PCWrite`、`Branch`和`RegWrite`。

为了保障下面的状态转移图具有可队形，我们只列出相关的控制信号。选择信号只在其意义重大的地方列出，否则无需关心；而使能信号只有导通时才会被列出，否则为`0`;

任何指令的第一步都是从`PC`上对应的存储器上的地址中获取指令开始的。状态机在复位时进入该状态，为了读取内存，$IorD = 0$，因此地址取自`PC`。`IRWrite`被导通是是将指令写入指令寄存器`IR`中。同时，`PC`应自增以指向下一条指令。因为当前状态`ALU`并未被使用，因此处理器在取值的同时可以计算`PC + 4`。`ALUSrcA = 0`因此`SrcA`来自于`PC`；$ALUSrcB = 01$因此$SrcB = 4$；$ALUOp = 00$所以$ALU$解码器产生$ALUControl = 010$，使`ALU`进行加法运算；为了使得`PC`值更新，因此$PCSrc = 0, PCWrite = 1$。该状态如下图所示，蓝色虚线表示指令取值，`PC`变化用灰色虚线表示。

![data flow during fetch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202205240.png)

下一步使读取`regfile`和解码指令。`regfile`总是读取指令的`rs`和`rt`字段指定的两个源寄存器。同时，立即数被符号扩展。解码涉及到检查指令的`opcode`来决定下一步做什么。解码指令不需要控制信号，但状态机必须等待一个周期以完成读取和解码，如下图所示，新状态以蓝色突出显示。

![data flow during decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202209814.png)

现在状态机根据`opcode`进入几种可能的状态之一：

如果指令是`lw`或`sw`，多周期处理器通过将基址和符号扩展的立即数相加，因此就需要$ALUSrcA = 1$来选择寄存器`A`；$ALUSrcB = 10$来选择`SignImm`；`ALUOp = 00`使得`ALU`相加。

![data flow during memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202213649.png) 

如果指令是`lw`，多周期处理的下一步必须是从存储器中读取数据并写到`regfile`中。为了读取内存，$IorD = 1$来选择刚刚计算并保存在`ALUOut`中的内存地址。在步骤`S3`中，该地址在内存中被读取，并保存在`Data`寄存器中。在下一步`S4`中，`Data`被写入`refile`：$MemtoReg = 1$来选择`Data`，然后$RegDst = 0$来选择`rt`字段作为目的寄存器。`RegWrite`被导通使得允许写入，此时完成`lw`指令。最终，状态机返回初始状态`S0`来获取下一条指令。

![data flow during write back](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202231451.png)

返回状态`S2`，如果指令是`sw`，那么从`regfile`中的`RD2`中读出数据然后写入内存。在`S3`中，$IorD = 1$来选择在`S2`中计算并保存在`ALUOut`中的内存地址。`MemWrite`被导通用以写入内存。然后，状态机回到`S0`获取下一条指令。

![data flow during write](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202237344.png)

如果`opcode`表示是`R-type`指令，多周期处理器必须通过`ALU`计算结果并且将其写回到`regfile`。在`S6`中，通过选择`A`和`B`寄存器($ALUSrcA = 1, ALUSrcB = 00$)执行指令中`funct`字段指示的`ALU`操作。对于所有的`R-type`指令，$ALUOp = 10$。`ALUResult`存储在`ALUOut`中。在`S7`中，`ALUOut`被写入`regfile`，$RegRst = 1$，因为此时的目的寄存器为`rd`。$MemtoReg = 0$，因为写入数据`WD3`来自于`ALUOut`，`RegWrite`被激活以写入`regfile`中。

![r-type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202244633.png)

对于`beq`指令，处理器必须计算目标地址并比较两个源寄存器，以确定是否应该执行分支。这需要使用`ALU`两次，因此可能看起来需要两个新状态。**然而，请注意，在读取寄存器时**`S1`**期间并未使用**`ALU`。处理器可以在那个时候使用`ALU`来计算目标地址，方法是将增加的`PC'`，即$PC + 4$，与$SignImm \times 4$相加。$ALUSrcA = 0$用于选择增加的`PC'`，$ALUSrcB = 11$用于选择$SignImm \times 4$，$ALUOp = 00$用于加法。目标地址存储在`ALUOut`中。如果指令不是`beq`，计算的地址将不会在后续周期中使用，但其计算是无害的。在`S8`中，处理器通过对两个寄存器进行减法操作并检查结果是否为`0`来比较它们。如果是，处理器将分支到刚刚计算的地址。$ALUSrcA = 1$用于选择寄存器`A`；$ALUSrcB = 00$用于选择寄存器`B`；$ALUOp = 01$用于减法；$PCSrc = 1$用于从`ALUOut`中取目标地址，并且$Branch = 1$表示如果`ALU`结果为`0`，则更新`PC`为此地址。

![branch state](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202249653.png)

### Performance Analysis


指令的执行时间取决于它使用的周期数和周期时间。而单周期处理器在一个周期内执行所有指令，多周期处理器则对各种指令使用不同数量的周期。然而，多周期处理器在单个周期内执行的工作量较少，因此具有较短的周期时间。多周期处理器需要对`beq`和`j`指令使用三个周期，对`sw`、`addi`和`R-type`指令使用四个周期，对`lw`指令使用五个周期。`CPI`取决于每个指令被使用的相对概率。

回顾我们设计的多周期处理器，每个周期都涉及一个ALU操作、存储器访问或寄存器文件访问。假设寄存器文件比存储器更快，写入存储器比读取存储器更快。检查数据通路揭示了两条可能限制周期时间的关键路径：

$$
    T_c = t_{pcq} + t_{mux} + max[t_{ALU} + t_{mux}, t_{mem}] + t_{setup}
$$

## Pipelined Processor