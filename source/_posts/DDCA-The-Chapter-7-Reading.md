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

流水线技术是提高数字系统吞吐量的强大方式。我们通过将单周期处理器细分为五个流水线阶段来设计流水线处理器，因此，五条指令可以同时执行，每个阶段执行一条指令。由于每个阶段只有整个逻辑的五分之一，时钟频率几乎快了五倍。因此，每条指令的延迟在理想情况下不变，但吞吐量理想情况下提高了五倍。微处理器每秒执行数百万到数十亿条指令，因此，吞吐量比延迟更重要。流水线技术引入了一些开销，因此吞吐量可能不会像我们理想地希望的那样高，但流水线技术为极少的成本提供了巨大优势，因此所有现代高性能微处理器都采用了流水线技术。

读取和写入内存和`regfile`，以及使用`ALU`通常构成处理器中的最大延迟。我们选择了五个流水线阶段，以便每个阶段都包含其中一个较慢的步骤。具体来说，我们称这五个阶段为`取指(Fetch)`、`解码(Decode)`、`执行(Execute)`、`存储器(Memory)`和`写回(Writeback)`。它们类似于多周期处理器用于执行`lw`的五个步骤。在取指阶段，处理器从指令存储器中读取指令。在解码阶段，处理器从寄存器文件中读取源操作数，并解码指令以产生控制信号。在执行阶段，处理器使用`ALU`进行计算。在存储器阶段，处理器读取或写入数据存储器。最后，在写回阶段，处理器在适用时将结果写入`regfile`。

下图给出了单周期和流水线处理器的时序比图。时间在横轴上，指令在纵轴上。该图假定了逻辑单元延迟，忽略了多路选择器和寄存器的延迟。在图(a)中，第一条指令在`0`时刻从存储器中读出；接下来从`regfile`中读取操作数；然后`ALU`执行必要的计算；再者，访问数据存储器，最终在$950ps$时刻时回写到`regfile`。于是该单周期的延迟为$950ps$。

![time diagrams](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210836280.png)

图(b)展示了流水线处理器，其中最慢的一个阶段被设置为$250ps$，即取值或访存阶段中的读写内存操作。在`0`时刻时，第一条指令从存储器中被读出；在$250ps$时刻，第一条指令进入译码阶段，第二条指令开始被读取；在$500ps$，第一条指令被执行，第二条指令进入译码阶段，第三条指令开始被加载；以此类推，直到所有指令被完成。此时的指令延迟为$5 \times 250 = 1250ps$，吞吐量为$250ps/inst$。**由于各个阶段的逻辑量不完全平衡，流水线处理器的延迟略长于单周期处理器。同样地，对于五级流水线处理器，吞吐量并不完全是单周期处理器的五倍。然而，吞吐量的优势仍然是相当大的**。

下图展示了一个运动中的流水线抽象视角，其中每个阶段都以图像的方式表示。每个流水线阶段都用其主要组成部分表示，指令存储器(`IM`)、`regfile`读(`RF`)、`ALU`执行、数据存储器(`DM`)和`regfile`写(`RW`)。读取一行展示了一条指令在每一个阶段上的时钟周期。读取一列展示了多个流水线阶段在同一个时钟周期上执行。每个阶段用阴影部分表示正在被使用。在流水线处理器中，`regfile`在一个周期的第一部分写入，第二个部分读取，通过这种方式，可以在单个周期内写入和读回数据。

![abstract view of pipeline](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210851673.png)

流水线系统中的一个核心挑战是处理当一个指令的结果在前一条指令完成之前就被后续指令所需要时发生的`冲突(hazards)`。例如，如果上图中的加法指令使用的是`$s2`而不是`$t2`，那么会发生冲突，因为在加法指令读取`$s2`之前，`lw`指令尚未将数据写入`$s2`寄存器。本节探讨了`转发(forwarding)`、`停顿(stalls)`和`清空(flushes)`作为解决冲突的方法。最后，本节重新考虑了性能分析，考虑了序列化开销和冲突的影响。

### Pipelined Datapath

流水线的数据通路是将单周期数据通路切割成由流水线寄存器间隔的五个阶段形成的。图(a)展示了单周期数据通路的延伸，其为流水线寄存器留下了足够的空间。图(b)展示了通过插入四个流水线寄存器形成的流水线数据通路，将数据通路分为五个阶段。每个阶段及其边界用蓝色表示。信号用一个后缀(`F`、`D`、`E`、`M`和`W`)来表示它们所处的阶段。

![five-stage pipeline data path](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210910816.png)

`regfile`是比较特殊的，因为它在译码阶段被读，回写阶段被写入。它是在译码阶段被绘制的，但写地址和数据来自于写回阶段，这种反馈将会导致流水线冲突。流水线处理器中的`regfile`在`CLK`的下降沿写入，此时`WD3`是稳定的。

流水线中一个微妙但关键的问题在于**特定指令相关的所有信号必须一致地通过流水线推进**，但上图中的`regfile`写逻辑中，即写回阶段操作，数据值来自于写回阶段的`ResultW`信号，但是地址却来自于执行阶段的`WriteRegE`信号。比如下面的例子：

``` asm
lw $s2, 40($0)
add $s3, $t1, $t2
sub $s4, $s1, $5 
```

当第一条指令`lw $s2, 40($0)`处于第五个周期时，第三条指令恰好将`$s4`译码为目的寄存器，因此，当第五个周期将第一条指令的`ResultW`信号发出后，写入的实际上是`$s4`而非第一条指令的`$s2`。

下图展示了正确的数据通路，`WriteReg`信号现在在`Memory`阶段和`Write Back`阶段被流水线化，因此它与指令的其余部分保持同步。`WriteRegW`和`ResultW`信号被一起反馈到`Write Back`阶段的`regfile`中。

![corrected pipeline datapath](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221612944.png)

一些敏锐的读者可能发现，`PC`的逻辑实际上也是有一定问题的，因为它可能会用`Fetch`或`Memory`阶段的信号(`PCPlus4F`或`PCBranchM`)，情况我们在后面再讨论。

### Pipelined Control

流水线处理器与单周期处理器使用着相同的信号，因此也就使用了相同的控制单元。不过，**这些控制信号必须与数据一同流水线化，以便与指令保持同步**。

下图是带有控制的流水线处理器，`RegWrite`在反馈到`regfile`之前必须被流水线送入`Write Back`阶段，正如同`WriteReg`在之前那样。

![pipeline processor with control](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221618134.png)

### Hazards

在一个流水线系统中，多条指令是被同时处理的。**当一条指令依赖于另一个尚未完成的结果时，就会产生**`冲突(hazards)`。

`regfile`能够在同一个周期内进行读写操作，但**写操作发生在一个周期的前半部分，读操作发生在一个周期的后半部分，因此寄存器可以在同一个周期内写入和读回而不引入冲突**。

![abstract pipeline diagram](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221622059.png)

上图图解了一个冲突发生在一条指令写入寄存器`$s0`而随后一条指令将要读取寄存器`$s0`的时候。这被称为`读后写入冲突(read after write, RAW hazard)`。`add`指令会在第五个周期的前半个周期将结果写入`$s0`，然而，`and`指令在第三个周期读取`$s0`，因而得到了错误的值。`or`指令在第四个周期读取`$s0`，同样会得到错误的值。`sub`指令在第五个周期的后半个周期读取`$s0`，因此得到了在第五个周期的前半个周期写入的正确的值。从这以后，后面的指令都能读取到正确的`$s0`的值。上图显示，**当一条指令写入一个寄存器，并且后面的两条指令中的任何一条读到该寄存器时，该流水线就会发生冲突。如果不做任何特殊处理，流水线将会计算出错**。

然而，仔细观察可以得出，`add`指令的计算结果总是在第三周期的`ALU`计算得出，而直到在第四周期`ALU`使用它时，才会在`and`指令中严格要求。**原则上，我们能够将结果从一条指令转发给下一条指令来解决**`RAW`**冲突**。在后续将要讨论的冲突中，可能还需要暂停流水线以为得出结果留出足够的时间。

冲突通常被分为两类：`数据冲突(data hazard)`和`信号冲突(control hazard)`。**数据冲突通常发生在一条指令尝试去读取一个上一条指令还未写回的寄存器时；而信号冲突则发生在取值后还未决定下一步取值的指令是什么时**。在后续的章节，我会介绍使用冲突单元来对流水线处理器进行增强，以检测冲突并进行适当的处理，使处理器正确地执行程序。

#### Solving Data Hazards with Forwarding

一些数据冲突能够被`转发(forwarding or bypassing)`解决，也就是**通过转发从`Memory`或`Write Back`阶段转发得到的结果到`Execute`阶段所依赖的指令上**。这就需要在`ALU`前添加多路选择器，以便从`regfile`、`Memory`或`Write Back`阶段选择操作数。下图解释了这一原理。在周期四中，`$s0`从`add`指令的`Memory`阶段转发到需要依赖结果的`and`的`Execute`阶段。而周期五中，`$s0`从`add`指令的`Write Back`阶段转发到需要依赖结果的`or`的`Execute`阶段。

![abstract pipeline diagram forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221645749.png)

**当执行阶段的一条指令有一个源寄存器与上一条指令在`Memory`或`Write Back`阶段的目的寄存器匹配时，转发就是必要的**。下图修改了流水线处理器以支持转发，其新增了一个`冲突预测单元(hazard detection unit)`和两个转发多路选择器。冲突预测单元接收两个处于`Execute`阶段的源寄存器和处于`Memory`或`Write Back`阶段的目的寄存器，还接收来自`Memory`和`Write Back`阶段的`RegWrite`信号以便于了解目的寄存器是否会被实际写入(因为类似`sw`和`beq`指令不将结果写入`regfile`中，因此不需要转发)。值得注意的是，`RegWrite`信号在图中是通过名字连接的，而非直接使用长导线来横贯图示以使得图示混乱。

![pipeline processor with forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221651697.png)

冲突预测单元计算控制信号，用于转发多路复用器从`regfile`中选择操作数，或从`Memory`或`Write Back`阶段的结果中选择操作数。如果一个阶段将要写入一个目的寄存器，且该目的寄存器和源寄存器匹配，则应该从该阶段向前转发。但是，在`MIPS`中的`$0`寄存器无需转发，因为其恒为`0`值。如果`Memory`和`Write Back`阶段都包含匹配的目的寄存器，那么`Memory`阶段应该具有优先性的，因为它包含了最近执行的指令。因此，对于$SrcA$给出如下代码：

``` verilog
// 如果rs1寄存器不为$0，rs1与Memory阶段的目的寄存器匹配，且写使能导通
if ((rsE != 0) and (rsE == WriteRegM) and RegWriteM) then 
    ForwardAE = 10      // 直接从ALU计算结果处开始转发
// 如果rs1寄存器不为$0，rs1与Write Back阶段的目的寄存器匹配，且写使能导通
else if ((rsE != 0) and (rsE == WriteRegW) and RegWriteW) then
    ForwardAE = 01      // 从写回阶段转发
// 没有发生数据冲突
else 
    ForwardAE = 00      // rs1可以直接进行计算
```

这里也给出对应$SrcB$的代码，和$SrcA$相同，只不过判断的寄存器从`rs`变为`rt`：

``` verilog
if ((rtE != 0) and (rtE == WriteRegM) and RegWriteM) then
    ForwardBE = 10      
else if ((rtE != 0) and (rtE == WriteRegW) and RegWriteW) then
    ForwardBE = 01      
else 
    ForwardBE = 00      
```

#### Solving Data Hazards with Stalls

当结果在指令的`Execute`阶段被计算时，转发就足以处理`RAW`数据冲突，因为其结果可以被转发给下一条指令的`Execute`阶段。但是，对于`lw`指令而言，其直到`Memory`阶段结束才完成读取数据，因此其结果不能转发到下一条指令的`Execute`阶段。因此，我们称`lw`有两个周期的延迟，因为一个依赖指令不能使用它的结果，直到两个周期后才被允许。下图显示了这个问题，`lw`指令在周期四结束时从`Memory`中读取数据，但`and`指令需要在第四个周期开始时将数据作为源操作数进行计算，因此这种情况下，转发就不再有效。

![abstract pipeline diagram trouble forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221725010.png)

可供选择的解决方案是`暂停(stall)`管道，停止运行直到数据可用为止。下图展示了在`Decode`阶段暂停依赖指令`and`。`and`指令在第三周期进入`Decode`阶段，然后暂停直到第四周期结束，后续的指令`or`也必须保持在`Fetch`阶段。

![abstract pipeline diagram stall](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221731679.png)

在第五个周期，`lw`的的结果可以从`lw`的`Write Back`阶段转发到`and`的`Execute`阶段，而此时的`or`指令的$s0$并不需要转发，直接从`regfile`读取即可，因为此时结果已经写回到`regfile`中。

注意，`Execute`阶段在周期四中并未被使用，同样`Memory`在周期五以及`Write Back`在周期六也是如此。这样通过流水线传播的未被使用的阶段被称为`气泡(bubble)`，它的行为就像一个`nop`指令。在`Decode`阶段暂停期间，通过将`Execute`阶段的控制信号置零来引入`bubble`，使得气泡不执行任何动作，也不改变架构状态。

**总之，通过停用流水线寄存器来暂停流水线阶段的进行，使得其内容不发生变化。当一个阶段暂停时，之前的所有阶段都会因此停顿，以免后续指令丢失。为了防止伪信息向前传递，必须清空在该阶段之后的流水线。暂停会降低新能，因此只能在必要时使用**。

下图是修改后的流水线处理器，为`lw`指令的数据依赖添加暂停操作。冲突预测单元在`Execute`阶段对指令进行检查：如果是`lw`指令，其目的寄存器`rtE`与`Decode`阶段的`rsD`或`rtD`的任意源操作数匹配，则该指令就必须在`Decode`阶段暂停，直到源操作数准备好。

![pipeline for stall](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221824653.png)

通过在`Fetch`和`Decode`阶段的流水线寄存器中添加使能输入`EN`和在`Execute`阶段添加同步的复位/清除输入(`CLR`)来支持暂停操作。当`lw`指令暂停发生时，`StallD`和`StallF`被导通使得`Decode`和`Fetch`阶段的流水线寄存器保持其旧值。`FlushE`导通，并且清空执行阶段流水线寄存器的值，引入一个`bubble`。`MemtoReg`信号被导通。

``` verilog
lwstall = ((rsD == rtE) or (rtD = rtE)) and MemtoRegE
StallF = StallD = FlushE = lwstall
```

#### Solving Control Hazards

`beq`指令存在一个`控制冲突(control hazard)`：**流水线处理器不知道下一次取指什么指令，因为下一次取指时还没有做出分支决策**。

**处理控制冲突的一种机制是将流水线暂停，直到分支决策确定。但是，由于决策是在**`Memory`**阶段决定的，因此每个分支，流水线都必须暂停三个周期，这是我们无法接受的**。

**一种更好的方法是预测分支是否会被取走，并根据预测结果开始执行指令。一旦分支决策做出，并且预测其错误，处理器就会丢弃这些指令。尤其是，假设我们预测的分支不会被执行，然后按照顺序执行程序。如果分支本应该执行，则必须通过清空这些流水线寄存器来丢弃分支后的三条指令，这种浪费被称为**`分支预测错误惩罚(branch misprediction penalty)`。

下图便展示了这一机制，其中从地址`20`到地址`64`中取一个分支。该分支直到周期四才做出分支决策，此时地址`24`、`28`、`2C`处的`and`、`or`、`sub`指令已经被取出，因此这些指令必须被刷新，然后`slt`指令被取出。这在一定程度上相较于暂停做出了改进，但是一旦进行分支决策时的指令数过多，全部冲洗掉就会降低性能。

![abstract pipeline diagram flushing when branch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221839922.png)

如果能够更早地做出决策，则可以减少分支预测错误惩罚。决策只需要比较两个寄存器的值即可。使用专用的比较器比执行减法和零检测要快得多。如果比较器的速度足够快，可用将其移回`Decode`阶段，以便从`regfile`中读取操作数并进行比较。

下图展示了在第二个周期进行早期分支预测的流水线运行情况。在第三周期，刷新`and`指令并取出`slt`指令，现在分支预测错误惩罚被减少到只有一条指令。

![ealier branch decision](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221846278.png)

下图修改了流水线处理器，以便更早地移动分支决策和处理控制冲突。在`Decode`阶段增加一个相等比较器，并提前移动了$PCSrc AND$门，这就使得`Decode`阶段而非`Memory`阶段确定$PCSrc$。`PCBranch`加法器必须移入`Decode`阶段以便于及时计算目的地址。在`Decode`阶段的流水线寄存器中添加与$PCSrcD$相连的`CLR`信号，以便在分支决策时能够对读取的指令进行刷新。

![solving branch control](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221848694.png)

不幸的是，过早的分支预测硬件引入了新的`RAW`数据冲突。具体地说，**如果分支的一个源操作数是通过先前的指令计算得到的，尚未写入**`regfile`，**则该分支将从**`regfile`**中读取到错误的操作数值**。因此，我们还需要通过转发正确的值来解决数据冲突，或许也可以通过暂停流水线以获得已准备的数据。

下图给出了具体的流水线处理器的修改。如果一个结果处于`Write Back`阶段，它将在周期的前半部分被写入，在后半部分被读出。因此不存在冲突；如果一个`ALU`指令的结果处于`Memory`阶段，则可用通过新增的两个多路选择器将其转发给相等比较器。如果`ALU`指令的结果在`Execute`阶段，或者`lw`指令的结果在`Memory`阶段，则必须在`Decode`阶段暂停流水线，直到结果准备就绪。

![handing data](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221903204.png)

这里给出`Decode`阶段的转发逻辑

``` verilog
// 如果需要比较的源操作数是后续处于Memory阶段的值，就需要转发
ForwardAD = (rsD != 0) and (rsD == WriteRegM) and RegWriteM
ForwardBD = (rtD != 0) and (rtD == WriteRegM) and RegWriteM
```

下面给出分支的暂停分支逻辑。处理器必须在`Decode`阶段进行分支预测。如果分支的任何一个源操作数在`Execute`阶段依赖于`ALU`指令，或者在`Memory`阶段依赖于`lw`指令，则处理器就应该暂停，直到源操作数准备就绪。

``` verilog
branchstall = 
    BranchD and RegWriteE and (WriteRegE == rsD or WriteRegE == rtD)
    or
    BranchD and MemtoRegM and (WriteRegM == rsD or WriteRegM == rtD)
```

现在就得出了完整的逻辑：

``` verilog
StallF = StallD = FlushE = lwstall or branchstall
```

### Summary

`RAW`**数据冲突发生在一条指令依赖于另一条指令的结果，而后者尚未写入寄存器文件时。如果结果能够很快计算出来，可以通过转发来解决数据冲突；否则，它们需要暂停流水线，直到结果可用**。

**控制冲突发生在到达下一条指令必须获取之时，决定应该获取哪条指令的决定尚未做出。通过预测应该获取哪条指令并且在后续确认预测错误时清空流水线来解决控制冲突。尽早做出决定可以最大程度地减少错误预测时清空的指令数量**。

到目前为止，设计流水线处理器的挑战之一是了解所有指令之间可能存在的所有交互作用，并发现可能存在的所有冲突。下图展示了处理所有冲突的完整流水线处理器。

![whole](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221913172.png)