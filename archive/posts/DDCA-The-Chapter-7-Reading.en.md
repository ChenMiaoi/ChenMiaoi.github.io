---
slug: DDCA-The-Chapter-7-Reading.en
title: 'DDCA: The Chapter 7 Reading'
published: 2024-04-20
tags:
  - ysyx
  - digital
  - logic
  - pipeline
  - architecture
category: books
series: ddca
lang: "en"
---
In this note, we develop three microarchitectures for the `MIPS` processor architecture: single-cycle, multicycle, and pipelined.

## Single-Cycle Processor

We first introduce a `MIPS` microarchitecture that executes instructions in a single cycle. We begin constructing the datapath by connecting the state elements shown in the figure below with combinational logic that can execute the various instructions. **The control signals determine which specific instruction the datapath executes at any given time; the controller contains combinational logic that generates the appropriate control signals based on the current instruction**.

![State element of MIPS processor](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201429220.png)

### Single-Cycle Datapath

This section develops a single-cycle datapath step by step, adding one small piece at a time between the state elements of the figure above. Newly added hardware is highlighted in black (or blue), while hardware already studied is shown in gray.

The program counter (`PC`) register contains the address of the instruction to execute. The first step is to read the instruction from instruction memory. The figure below simply shows the `PC` connected to the address input of the instruction memory. The instruction memory reads out (or `fetches`) a $32-bits$ instruction, labeled `Instr`.

![fetch instruction from memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201443500.png)

The behavior of the processor depends on the specific instruction fetched. First, we will work out the datapath for the `lw` instruction; then we will consider how to generalize the datapath to handle the other instructions.

For an `lw` instruction, the next step is to read the source register containing the base address. This register is specified in the `rs` field of the instruction, $Instr_{25:21}$. These bits of the instruction are connected to the address input of one of the `regfile` read ports, `A1`, as shown in the figure below. The $regfile$ reads the register value onto `rd1`.

![regfile](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201449462.png)

The `lw` instruction also requires an `offset`. This offset is stored in the `immediate` field of the instruction, $Instr_{15:0}$. Because the $16-bits$ immediate can be positive or negative, we must sign-extend it to $32-bits$, as shown in the figure above. The $32-bits$ sign-extended value is called $SignImm$.

The processor must add the base address and the offset to obtain the address of the data actually read from memory. The figure below introduces an `ALU` to perform this addition. The $ALU$ receives two operands, $SrcA$ and $SrcB$; $SrcA$ comes from the `refile`, while $SrcB$ is the sign-extended immediate. The $3-bits \ ALUControl$ signal specifies the various operations, and the $ALU$ generates a $32bits$ $ALUResult$ and a $Zero$ flag. For the `lw` instruction, the $ALUControl$ signal should be set to `010` to add the base address and the offset. The $ALUResult$ is sent to the data memory as the address for the load instruction, as shown in the figure below.

![compute memory address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201522987.png)

The data read from the data memory is driven onto the `ReadData` bus and then written back to the destination register in the `regfile` at the end of the cycle, as shown in the figure below.

![write data back to register file](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201526440.png)

The destination register of the `lw` instruction is specified in the `rd` field, and $Instr_{20:16}$ is connected to $A3$ of the `regfile`. The `ReadData` bus is connected to $WD3$ of the `regfile`. A control signal called `RegWrite` is connected to $WE3$ and is asserted for the `lw` instruction, allowing the data to be written into the `regfile`.

After the instruction is executed, the processor must compute the address of the next instruction, $PC'$. Because instructions are $32bits = 4 bytes$, the next instruction is at $PC + 4$. The figure below uses another adder to increment the $PC$. The new address is written into the program counter on the next rising clock edge. This completes the `lw` datapath.

![determine address of next](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201535839.png)

Next, let us extend the datapath to also handle the `sw` instruction. Like `lw`, the `sw` instruction reads a base address from the `regfile` and a sign-extended immediate. The `sw` instruction can also read a second register and write it to the data memory, as shown in the figure below. This register is called `rt`, $Instr_{20:16}$, and is connected to `A2` of the `regfile`. The register value is read onto the `RD2` port, which is then connected to the `WD` port of the data memory.

![write data to memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404201957750.png)

On the data memory, there is an additional `MemWrite` control port to indicate whether a write should occur, while `ALUControl = 010` performs the addition of the base address and the offset. Now consider extending the datapath to handle the `R-type` instructions `add`, `sub`, `and`, `or`, and `slt`. All of these instructions read two registers from the `regfile`, perform the corresponding operation on them, and write the result back to a third register. Therefore, they can all be handled with the same hardware using different `ALUControl` signals.

The figure below shows the enhanced datapath: the `regfile` reads two registers, and the $ALU$ performs different operations to process them. Note that previously $SrcB$ only received a $SignImm$ as input, but now a multiplexer is needed to choose between $SignImm$ and $RD2$. Also, `lw` and `sw` always go through the data memory, but for `R-type` instructions the result produced by the `ALU` should be written directly back to the `regfile`. Therefore, we add a multiplexer between $ReadData$ and $ALUResult$, controlled by a new signal $MemtoReg$.

![enhanced datapath](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202005350.png)

Previously, the `lw` and `sw` instructions ultimately wrote to `rt`, the $Instr_{20:16}$ field; however, for `R-type` instructions, the write should go to `rd`, the $Instr_{15:11}$ field. Therefore, we add a third multiplexer to select which register is ultimately written back. This multiplexer is controlled by the $RegDst$ signal.

Finally, we need to extend the datapath to handle the `beq` instruction. `beq` compares two registers for equality and decides whether to branch. For `beq`, the branch offset still needs to be sign-extended, and the new address should be $PC' = PC + 4 + SignImm \times 4$. The figure below shows the modification to the datapath. We add a $Branch$ signal that works with the $ALU$ to determine whether a branch is taken, and add $PCBranch$ to compute the branch target address.

![datapath for beq](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202016781.png)

This completes the datapath of the single-cycle `MIPS` processor. Next, we should consider how to compute the control signals that direct the operation of our datapath.

### Single-Cycle Control

The control unit computes the control signals based on the `opcode` and `funct` fields, i.e. $Instr_{31:26}$ and $Instr_{5:0}$. The figure below shows how the control unit of the entire single-cycle `MIPS` processor is connected.

![complete processor](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202022145.png)

For the `MIPS` instruction set, most of the control information comes from the `opcode` field, but `R-type` instructions also need the `funct` field to determine the type of `ALU` operation. Therefore, we simplify the design by dividing the control unit into two blocks of combinational logic, as shown in the figure below. The main decoder computes most of the outputs from the `opcode` and also determines a $2bit$ `ALUOP` signal. The `ALU` decoder computes `ALUControl` from the `ALUOP` signal combined with the `funct` field.

![control unit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202028296.png)

The tables below are the truth tables for the `ALU` decoder and the main decoder:

![truth table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202031791.png)

### Performance Analysis

In a single-cycle processor, every instruction takes one clock cycle, so $CPI = 1$. The critical path of the `lw` instruction is shown in the figure below as a blue dashed line. It starts at the `PC`, which loads a new address on the clock edge; the instruction memory reads the next instruction; the `regfile` reads $SrcA$ while the immediate is sign-extended at the same time; and a selection is then made at the multiplexer to determine $SrcB$. The $ALU$ computes the actual effective address from these two values, the corresponding address is read from the data memory, and the $MemtoReg$ multiplexer selects $ReadData$, which must be written back to the `regfile` before the next rising clock edge:

$$
    T_c = t_{pcq\_PC} + t_{mem} + max[t_{RFread}, t_{sext} + t_{mux}] + t_{ALU} + t_{mem} + t_{mux} + t_{RFsetup}
$$

![critical path for lw](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202034921.png)

In most implementations, the `ALU`, memory, and `regfile` accesses are noticeably slower than the other operations. Therefore, the cycle time simplifies to:

$$
    T_c = t_{pcq\_PC} + 2t_{mem} + t_{RFread} + t_{ALU} + t_{RFsetup}
$$

## Multi-Cycle Processor

Now we start again from the very beginning with the memory and the `regfile`. In the single-cycle design, we used separate instruction and data memories to read and write instructions and data. Now, we choose to use a single combined memory for both instructions and data.

![state element](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202053459.png)

The `PC` contains the address of the instruction to execute. The first step is to read the instruction from memory; the figure below shows the connection between the `PC` and the memory. The fetched instruction is stored in a new `Instruction Register` so that it can be used by future cycles. This instruction register receives an enable signal $IRWrite$, which is asserted when the instruction needs to be updated.

![fetch inst](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202057254.png)

For the `lw` instruction, the next step is to read the source register `rs` containing the base address, i.e. $Instr+{25:21}$. This field is then connected to `A1` of the `regfile`; the corresponding data is read out and output through `RD1` into a register `A`.

![read source](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202103024.png)

Of course, the immediate, i.e. $Instr_{15:0}$, still needs to be sign-extended. Because the immediate is a field of the instruction and the instruction itself does not change while the current instruction is being processed, no extra register is needed to hold the immediate value.

The address to be loaded is computed by the `ALU`, and the final result is stored in a register called `ALUOut`, as shown below:

![Add base](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202106374.png)

The next step is to read the data from memory at the computed address. We add a multiplexer `Adr` in front of the memory to select the memory address; the multiplexer's select signal is called `IorD`, indicating whether the address is an instruction address or a data address. The data read from memory is stored in another register, `Data`. Note that **the multiplexer allows us to reuse the memory during the** `lw` **instruction: in the first step, the address is taken from the $PC$; then the address is taken from** `ALUOut` **to load the data**. Therefore, `IorD` must take different values in different steps, as will be described later.

![load data](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202108650.png)

Finally, the data is written back to the `regfile`:

![write data back](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202114951.png)

After all these operations have occurred, the processor must update the program counter. In the single-cycle processor, a dedicated adder sufficed. But in the multicycle processor, we can use the `ALU` while it is idle during the steps above. Therefore, we must insert multiplexers at the two input sources of the `ALU` so that $SrcA = PC, SrcB = 4$. The `PCWrite` signal causes the `PC` register to be written only in certain cycles.

![increment PC](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202118050.png)

This completes the datapath for the `lw` instruction. Now let us extend the datapath to handle the `sw` instruction. For `sw`, the change to the circuit is simply that the value read from the `regfile` is stored in a register and then written from that register into memory. A new control signal `MemWrite` is then added to the memory to enable the data write.

![datapath for sw](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202122377.png)

For `R-type` instructions, the two source registers are read in the same way as above. The data from register $B$ is selected at $SrcB$ through $ALUSrcB_{1:0}$. In the write-back stage, the `MemtoReg` signal selects whether the value in `ALUOut` is `R-type` or `lw` data, and the $RegDst$ signal determines whether the destination register is `rd` or `rt`.

![for R-type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202130883.png)

For the `beq` instruction, in the single-cycle processor we needed an additional adder and multiplexer to perform the computation; in the multicycle processor, since a hardware resource can be reused, we simply reuse the `ALU` to obtain the branch target address. In one of the steps, the `ALU` computes `PC + 4` and writes the result back to the `PC` register; therefore, we only need to left-shift the immediate on its way to $SrcB$, then add the updated `PC` value to the shifted immediate, and write the result back to the `PC` register to obtain the branch target address.

![complete multi](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202136801.png)

This completes the design of the multicycle `MIPS` processor datapath. The design process is very similar to that of the single-cycle processor: hardware is systematically connected between the state elements to handle each instruction. The main difference is that instructions execute over multiple steps. Non-architectural registers are inserted to hold the results of each step. In this way, the ALU can be reused multiple times, saving the cost of extra adders. Likewise, instructions and data can be stored in one shared memory. In the next section, we develop an FSM controller that delivers the appropriate sequence of control signals to the datapath at each step of each instruction.

### Multi-Cycle Control

As with the single-cycle processor, the multicycle processor also uses a control unit that computes the control signals based on the `opcode` and `funct` fields, as shown below.

![complete multi-cycle](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202150698.png)

However, unlike the simple control of the single-cycle processor, the main controller of the multicycle processor is a state machine that applies the appropriate control signals at the appropriate cycles or steps. The sequence of control signals depends on the instruction being executed.

![control unit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202152218.png)

The main controller produces the multiplexer select signals and the register enable signals. The select signals are `MemtoReg`, `RegDst`, `IorD`, `PCSrc`, `ALUSrcB`, and `ALUSrcA`; the enable signals are `IRWrite`, `MemWrite`, `PCWrite`, `Branch`, and `RegWrite`.

To keep the following state transition diagrams readable, we only list the relevant control signals. Select signals are listed only where their values matter; otherwise they are don't-cares. Enable signals are listed only when they are asserted; otherwise they are `0`.

The first step of any instruction is to fetch the instruction from the memory address held in the `PC`. The state machine enters this state on reset. To read memory, $IorD = 0$, so the address is taken from the `PC`. `IRWrite` is asserted to write the instruction into the instruction register `IR`. Meanwhile, the `PC` should be incremented to point to the next instruction. Because the `ALU` is not being used in the current state, the processor can compute `PC + 4` while fetching. `ALUSrcA = 0`, so `SrcA` comes from the `PC`; $ALUSrcB = 01$, so $SrcB = 4$; $ALUOp = 00$, so the $ALU$ decoder produces $ALUControl = 010$, making the `ALU` add; and to update the `PC` value, $PCSrc = 0, PCWrite = 1$. This state is shown in the figure below; the blue dashed lines indicate the instruction fetch, and the `PC` update is shown with gray dashed lines.

![data flow during fetch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202205240.png)

The next step is to read the `regfile` and decode the instruction. The `regfile` always reads the two source registers specified by the `rs` and `rt` fields of the instruction. Meanwhile, the immediate is sign-extended. Decoding involves examining the `opcode` of the instruction to determine what to do next. Decoding the instruction requires no control signals, but the state machine must wait one cycle for the reading and decoding to complete, as shown in the figure below, where the new state is highlighted in blue.

![data flow during decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202209814.png)

The state machine now enters one of several possible states depending on the `opcode`:

If the instruction is `lw` or `sw`, the multicycle processor computes the address by adding the base address to the sign-extended immediate, which requires $ALUSrcA = 1$ to select register `A`; $ALUSrcB = 10$ to select `SignImm`; and `ALUOp = 00` to make the `ALU` add.

![data flow during memory](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202213649.png) 

If the instruction is `lw`, the next step of the multicycle processor must read the data from memory and write it to the `regfile`. To read memory, $IorD = 1$ selects the memory address that was just computed and saved in `ALUOut`. In step `S3`, this address is read from memory and the data is saved in the `Data` register. In the next step, `S4`, `Data` is written to the `refile`: $MemtoReg = 1$ selects `Data`, and $RegDst = 0$ selects the `rt` field as the destination register. `RegWrite` is asserted to allow the write, completing the `lw` instruction. Finally, the state machine returns to the initial state `S0` to fetch the next instruction.

![data flow during write back](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202231451.png)

Returning to state `S2`: if the instruction is `sw`, the data read from `RD2` of the `regfile` is written to memory. In `S3`, $IorD = 1$ selects the memory address computed in `S2` and saved in `ALUOut`. `MemWrite` is asserted to write to memory. The state machine then returns to `S0` to fetch the next instruction.

![data flow during write](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202237344.png)

If the `opcode` indicates an `R-type` instruction, the multicycle processor must compute the result with the `ALU` and write it back to the `regfile`. In `S6`, the `ALU` operation indicated by the `funct` field of the instruction is performed by selecting registers `A` and `B` ($ALUSrcA = 1, ALUSrcB = 00$). For all `R-type` instructions, $ALUOp = 10$. The `ALUResult` is stored in `ALUOut`. In `S7`, `ALUOut` is written to the `regfile`; $RegRst = 1$ because the destination register here is `rd`, and $MemtoReg = 0$ because the write data `WD3` comes from `ALUOut`. `RegWrite` is asserted to write into the `regfile`.

![r-type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202244633.png)

For the `beq` instruction, the processor must compute the target address and compare the two source registers to determine whether the branch should be taken. This requires using the `ALU` twice, so it might seem that two new states are needed. **However, note that the** `ALU` **is not used during** `S1` **while the registers are being read**. The processor can use the `ALU` at that time to compute the target address by adding the incremented `PC'`, i.e. $PC + 4$, to $SignImm \times 4$. $ALUSrcA = 0$ selects the incremented `PC'`, $ALUSrcB = 11$ selects $SignImm \times 4$, and $ALUOp = 00$ makes the `ALU` add. The target address is stored in `ALUOut`. If the instruction is not `beq`, the computed address will not be used in subsequent cycles, but computing it is harmless. In `S8`, the processor compares the two registers by subtracting them and checking whether the result is `0`. If so, the processor branches to the address just computed. $ALUSrcA = 1$ selects register `A`; $ALUSrcB = 00$ selects register `B`; $ALUOp = 01$ selects subtraction; $PCSrc = 1$ takes the target address from `ALUOut`; and $Branch = 1$ means that if the `ALU` result is `0`, the `PC` is updated with this address.

![branch state](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404202249653.png)

### Performance Analysis


The execution time of an instruction depends on the number of cycles it uses and the cycle time. While the single-cycle processor executes every instruction in one cycle, the multicycle processor uses a different number of cycles for different instructions. However, the multicycle processor does less work in a single cycle and therefore has a shorter cycle time. The multicycle processor uses three cycles for `beq` and `j` instructions, four cycles for `sw`, `addi`, and `R-type` instructions, and five cycles for the `lw` instruction. The `CPI` depends on the relative frequency with which each instruction is used.

Recall that in the multicycle processor we designed, each cycle involves an ALU operation, a memory access, or a register file access. Assume that the register file is faster than memory, and that writing memory is faster than reading memory. Examining the datapath reveals two critical paths that may limit the cycle time:

$$
    T_c = t_{pcq} + t_{mux} + max[t_{ALU} + t_{mux}, t_{mem}] + t_{setup}
$$

## Pipelined Processor

Pipelining is a powerful way to improve the throughput of digital systems. We design a pipelined processor by subdividing the single-cycle processor into five pipeline stages, so that five instructions can execute simultaneously, one in each stage. Because each stage has only one-fifth of the entire logic, the clock frequency is almost five times faster. Thus, ideally the latency of each instruction is unchanged, but the throughput is ideally improved fivefold. Microprocessors execute millions to billions of instructions per second, so throughput matters more than latency. Pipelining introduces some overhead, so throughput may not be as high as we might ideally hope, but pipelining offers a great advantage for very little cost, and all modern high-performance microprocessors use it.

Reading and writing memory and the `regfile`, and using the `ALU`, typically constitute the largest delays in a processor. We chose five pipeline stages so that each stage contains one of these slower steps. Specifically, we call the five stages `Fetch`, `Decode`, `Execute`, `Memory`, and `Writeback`. They are similar to the five steps the multicycle processor uses to execute `lw`. In the Fetch stage, the processor reads the instruction from instruction memory. In the Decode stage, the processor reads the source operands from the register file and decodes the instruction to produce the control signals. In the Execute stage, the processor performs a computation with the `ALU`. In the Memory stage, the processor reads or writes the data memory. Finally, in the Writeback stage, the processor writes the result to the `regfile` when applicable.

The figure below shows timing diagrams comparing the single-cycle and pipelined processors. Time is on the horizontal axis and instructions are on the vertical axis. The diagrams assume the logic unit delays and ignore the delays of multiplexers and registers. In figure (a), the first instruction is read from memory at time `0`; next the operands are read from the `regfile`; then the `ALU` performs the necessary computation; then the data memory is accessed; and finally the result is written back to the `regfile` at $950ps$. The single-cycle processor thus has a latency of $950ps$.

![time diagrams](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210836280.png)

Figure (b) shows the pipelined processor, in which the slowest stage is set to $250ps$, i.e. the memory read/write in the fetch or memory access stage. At time `0`, the first instruction is read from memory; at $250ps$, the first instruction enters the decode stage and the second instruction begins to be fetched; at $500ps$, the first instruction executes, the second enters the decode stage, and the third begins to be loaded; and so forth until all instructions are completed. The instruction latency is now $5 \times 250 = 1250ps$, and the throughput is $250ps/inst$. **Because the amount of logic in each stage is not perfectly balanced, the latency of the pipelined processor is slightly longer than that of the single-cycle processor. Similarly, for a five-stage pipelined processor, the throughput is not quite five times that of the single-cycle processor. Nevertheless, the throughput advantage is still substantial**.

![abstract view of pipeline](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210851673.png)

The figure below shows an abstract view of the pipeline in motion, in which each stage is represented pictorially. Each pipeline stage is represented by its major component: instruction memory (`IM`), `regfile` read (`RF`), `ALU` execution, data memory (`DM`), and `regfile` write (`RW`). Reading across a row shows the clock cycles in which an instruction is in each stage. Reading down a column shows multiple pipeline stages executing in the same clock cycle. A stage is shaded when it is being used. In the pipelined processor, the `regfile` is written in the first part of a cycle and read in the second part, so that data can be written and read back within a single cycle.

A central challenge in pipelined systems is handling `hazards`, which occur when the result of one instruction is needed by a subsequent instruction before the former has completed. For example, if the add instruction in the figure above used `$s2` instead of `$t2`, a hazard would occur, because the `lw` instruction has not yet written its data to register `$s2` by the time the add instruction reads `$s2`. This section explores `forwarding`, `stalls`, and `flushes` as ways to resolve hazards. Finally, this section revisits the performance analysis, taking into account sequencing overhead and the effect of hazards.

### Pipelined Datapath

The pipelined datapath is formed by slicing the single-cycle datapath into five stages separated by pipeline registers. Figure (a) shows the single-cycle datapath stretched out to leave enough room for the pipeline registers. Figure (b) shows the pipelined datapath formed by inserting four pipeline registers, dividing the datapath into five stages. Each stage and its boundaries are indicated in blue. Signals are given a suffix (`F`, `D`, `E`, `M`, and `W`) to indicate the stage in which they reside.

![five-stage pipeline data path](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404210910816.png)

The `regfile` is special because it is read in the Decode stage and written in the Writeback stage. It is drawn in the Decode stage, but the write address and data come from the Writeback stage; this feedback can lead to pipeline hazards. In the pipelined processor, the `regfile` is written on the falling edge of `CLK`, when `WD3` is stable.

A subtle but critical issue in pipelining is that **all signals associated with a particular instruction must advance through the pipeline in unison**. However, in the `regfile` write logic of the figure above, i.e. the Writeback stage operation, the data value comes from the `ResultW` signal of the Writeback stage, but the address comes from the `WriteRegE` signal of the Execute stage. Consider the following example:

```asm
lw $s2, 40($0)
add $s3, $t1, $t2
sub $s4, $s1, $5 
```

When the first instruction, `lw $s2, 40($0)`, is in its fifth cycle, the third instruction happens to be decoding `$s4` as its destination register. Therefore, when the first instruction's `ResultW` signal is presented in the fifth cycle, the register actually written is `$s4` rather than the first instruction's `$s2`.

The figure below shows the corrected datapath. The `WriteReg` signal is now pipelined through the `Memory` and `Write Back` stages, so it stays synchronized with the rest of the instruction. The `WriteRegW` and `ResultW` signals are fed back together to the `regfile` in the `Write Back` stage.

![corrected pipeline datapath](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221612944.png)

Some astute readers may notice that the `PC` logic is actually also problematic, because it might use signals from either the `Fetch` or `Memory` stage (`PCPlus4F` or `PCBranchM`). We will discuss this situation later.

### Pipelined Control

The pipelined processor uses the same signals as the single-cycle processor and therefore the same control unit. However, **these control signals must be pipelined along with the data so that they remain synchronized with the instruction**.

The figure below shows the pipelined processor with control. `RegWrite` must be pipelined into the `Write Back` stage before being fed back to the `regfile`, just as `WriteReg` was earlier.

![pipeline processor with control](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221618134.png)

### Hazards

In a pipelined system, multiple instructions are processed simultaneously. **When an instruction depends on a result that has not yet completed, a** `hazard` **occurs**.

The `regfile` can be read and written within the same cycle, but **the write occurs in the first half of the cycle and the read occurs in the second half, so a register can be written and read back in the same cycle without introducing a hazard**.

![abstract pipeline diagram](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221622059.png)

The figure above illustrates a hazard that occurs when one instruction writes register `$s0` and a subsequent instruction is about to read register `$s0`. This is called a `read after write (RAW) hazard`. The `add` instruction writes its result to `$s0` in the first half of the fifth cycle. However, the `and` instruction reads `$s0` in the third cycle and thus obtains the wrong value. The `or` instruction reads `$s0` in the fourth cycle and likewise obtains the wrong value. The `sub` instruction reads `$s0` in the second half of the fifth cycle and therefore obtains the correct value written in the first half of the fifth cycle. From then on, subsequent instructions all read the correct value of `$s0`. The figure shows that **the pipeline has a hazard when one instruction writes a register and either of the two following instructions reads that register. Without any special handling, the pipeline will compute incorrect results**.

However, closer observation reveals that the result of the `add` instruction is always computed by the `ALU` in the third cycle, and it is not strictly needed by the `and` instruction until the `ALU` uses it in the fourth cycle. **In principle, we can forward the result from one instruction to the next to resolve the** `RAW` **hazard**. For the hazards to be discussed later, we may also need to stall the pipeline to allow enough time for the result to be produced.

Hazards are generally divided into two categories: `data hazards` and `control hazards`. **A data hazard usually occurs when an instruction tries to read a register that a previous instruction has not yet written back; a control hazard occurs when, after an instruction is fetched, it has not yet been decided which instruction should be fetched next**. In the following sections, I will introduce how the pipelined processor is enhanced with a hazard unit to detect hazards and handle them appropriately, so that the processor executes programs correctly.

#### Solving Data Hazards with Forwarding

Some data hazards can be solved by `forwarding (or bypassing)`, that is, **forwarding a result obtained from the `Memory` or `Write Back` stage to the dependent instruction in the `Execute` stage**. This requires adding multiplexers in front of the `ALU` to select operands from the `regfile` or from the `Memory` or `Write Back` stage. The figure below illustrates this principle. In cycle four, `$s0` is forwarded from the `Memory` stage of the `add` instruction to the `Execute` stage of the dependent `and` instruction. In cycle five, `$s0` is forwarded from the `Write Back` stage of the `add` instruction to the `Execute` stage of the dependent `or` instruction.

![abstract pipeline diagram forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221645749.png)

**Forwarding is necessary when an instruction in the Execute stage has a source register that matches the destination register of a previous instruction in the `Memory` or `Write Back` stage**. The figure below modifies the pipelined processor to support forwarding; it adds a `hazard detection unit` and two forwarding multiplexers. The hazard detection unit receives the two source registers in the `Execute` stage and the destination registers in the `Memory` or `Write Back` stage. It also receives the `RegWrite` signals from the `Memory` and `Write Back` stages so that it knows whether the destination register will actually be written (because instructions such as `sw` and `beq` do not write results to the `regfile` and therefore do not need forwarding). Note that in the figure the `RegWrite` signals are connected by name rather than by long wires running across the diagram, which would clutter it.

![pipeline processor with forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221651697.png)

The hazard detection unit computes control signals for the forwarding multiplexers to select operands from the `regfile` or from the results of the `Memory` or `Write Back` stage. If a stage is about to write a destination register and that destination register matches a source register, forwarding from that stage should take place. However, the `$0` register in `MIPS` needs no forwarding because it always holds the value `0`. If both the `Memory` and `Write Back` stages contain a matching destination register, the `Memory` stage should have priority because it contains the more recently executed instruction. Therefore, the following code is given for $SrcA$:

```verilog
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

The corresponding code for $SrcB$ is given here as well; it is the same as for $SrcA$, except that the register being checked changes from `rs` to `rt`:

```verilog
if ((rtE != 0) and (rtE == WriteRegM) and RegWriteM) then
    ForwardBE = 10      
else if ((rtE != 0) and (rtE == WriteRegW) and RegWriteW) then
    ForwardBE = 01      
else 
    ForwardBE = 00      
```

#### Solving Data Hazards with Stalls

When a result is computed in the `Execute` stage of an instruction, forwarding suffices to handle the `RAW` data hazard, because the result can be forwarded to the `Execute` stage of the next instruction. However, the `lw` instruction does not finish reading data until the end of the `Memory` stage, so its result cannot be forwarded to the `Execute` stage of the next instruction. We therefore say that `lw` has a latency of two cycles, because a dependent instruction cannot use its result until two cycles later. The figure below illustrates this problem: the `lw` instruction reads the data from `Memory` at the end of cycle four, but the `and` instruction needs the data as a source operand at the beginning of the fourth cycle. Forwarding does not work in this case.

![abstract pipeline diagram trouble forwarding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221725010.png)

An alternative solution is to `stall` the pipeline, stopping operation until the data is available. The figure below shows stalling the dependent instruction `and` in the `Decode` stage. The `and` instruction enters the `Decode` stage in the third cycle and stalls there through the end of the fourth cycle; the following instruction `or` must likewise remain in the `Fetch` stage.

![abstract pipeline diagram stall](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221731679.png)

In the fifth cycle, the result of `lw` can be forwarded from the `Write Back` stage of `lw` to the `Execute` stage of `and`. At this point the $s0$ of the `or` instruction needs no forwarding and can be read directly from the `regfile`, because the result has already been written back to the `regfile`.

Note that the `Execute` stage is unused in cycle four, as are `Memory` in cycle five and `Write Back` in cycle six. Such unused stages propagating through the pipeline are called `bubbles`, and they behave like a `nop` instruction. While the `Decode` stage is stalled, a `bubble` is introduced by zeroing out the control signals of the `Execute` stage, so that the bubble performs no action and changes no architectural state.

**In summary, a pipeline stage is stalled by disabling its pipeline register so that its contents do not change. When a stage is stalled, all preceding stages are stalled as well, so that no subsequent instructions are lost. The pipeline after the stalled stage must be flushed to prevent bogus information from propagating forward. Stalls degrade performance, so they should only be used when necessary**.

The figure below shows the modified pipelined processor, with stalls added for data dependencies of the `lw` instruction. The hazard detection unit examines the instruction in the `Execute` stage: if it is an `lw` instruction and its destination register `rtE` matches either source operand `rsD` or `rtD` of the instruction in the `Decode` stage, that instruction must be stalled in the `Decode` stage until the source operand is ready.

![pipeline for stall](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221824653.png)

Stalls are supported by adding enable inputs `EN` to the pipeline registers of the `Fetch` and `Decode` stages and a synchronous reset/clear input (`CLR`) to the `Execute` stage. When an `lw` stall occurs, `StallD` and `StallF` are asserted so that the `Decode` and `Fetch` pipeline registers hold their old values. `FlushE` is asserted and clears the contents of the Execute stage pipeline register, introducing a `bubble`. The `MemtoReg` signal is asserted.

```verilog
lwstall = ((rsD == rtE) or (rtD = rtE)) and MemtoRegE
StallF = StallD = FlushE = lwstall
```

#### Solving Control Hazards

The `beq` instruction presents a `control hazard`: **the pipelined processor does not know which instruction to fetch next, because the branch decision has not yet been made by the time of the next fetch**.

**One mechanism for dealing with control hazards is to stall the pipeline until the branch decision is determined. However, because the decision is made in the** `Memory` **stage, the pipeline would have to stall for three cycles on every branch, which is unacceptable to us**.

**A better approach is to predict whether the branch will be taken and begin executing instructions based on the prediction. Once the branch decision is made and the prediction turns out to be wrong, the processor discards these instructions. In particular, suppose we predict that the branch is not taken and simply continue executing the program in order. If the branch should have been taken, the three instructions after the branch must be discarded by flushing those pipeline registers. This waste is called the** `branch misprediction penalty`.

The figure below shows this mechanism, in which a branch from address `20` to address `64` is taken. The branch decision is not made until cycle four, by which point the `and`, `or`, and `sub` instructions at addresses `24`, `28`, and `2C` have already been fetched. These instructions must be flushed, and then the `slt` instruction is fetched. This is an improvement over stalling to some extent, but once too many instructions have been fetched by the time the branch decision is made, flushing them all degrades performance.

![abstract pipeline diagram flushing when branch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221839922.png)

If the decision could be made earlier, the branch misprediction penalty could be reduced. The decision only requires comparing the values of two registers. Using a dedicated comparator is much faster than performing a subtraction and a zero detection. If the comparator is fast enough, it can be moved back into the `Decode` stage, so that the operands are read from the `regfile` and compared there.

The figure below shows the pipeline operation with an early branch decision made in the second cycle. In the third cycle, the `and` instruction is flushed and the `slt` instruction is fetched. The branch misprediction penalty is now reduced to just one instruction.

![ealier branch decision](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221846278.png)

The figure below modifies the pipelined processor to move the branch decision earlier and handle control hazards. An equality comparator is added in the `Decode` stage, and the $PCSrc AND$ gate is moved earlier, so that $PCSrc$ is determined in the `Decode` stage rather than the `Memory` stage. The `PCBranch` adder must be moved into the `Decode` stage so that the destination address is computed in time. A `CLR` signal connected to $PCSrcD$ is added to the `Decode` stage pipeline register so that the fetched instruction can be flushed when the branch decision is made.

![solving branch control](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221848694.png)

Unfortunately, the early branch decision hardware introduces a new `RAW` data hazard. Specifically, **if one of the branch's source operands is computed by a previous instruction and has not yet been written to the** `regfile`, **the branch will read the wrong operand value from the** `regfile`. Therefore, we still need to resolve the data hazard by forwarding the correct value, or possibly by stalling the pipeline until the data is ready.

The figure below shows the specific modifications to the pipelined processor. If a result is in the `Write Back` stage, it is written in the first half of the cycle and read in the second half, so there is no hazard. If the result of an `ALU` instruction is in the `Memory` stage, it can be forwarded to the equality comparator through two new multiplexers. If the result of an `ALU` instruction is in the `Execute` stage, or the result of an `lw` instruction is in the `Memory` stage, the pipeline must be stalled in the `Decode` stage until the result is ready.

![handing data](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221903204.png)

The forwarding logic for the `Decode` stage is given here:

```verilog
// 如果需要比较的源操作数是后续处于Memory阶段的值，就需要转发
ForwardAD = (rsD != 0) and (rsD == WriteRegM) and RegWriteM
ForwardBD = (rtD != 0) and (rtD == WriteRegM) and RegWriteM
```

The branch stall logic is given below. The processor must make the branch decision in the `Decode` stage. If either source operand of the branch depends on an `ALU` instruction in the `Execute` stage, or on an `lw` instruction in the `Memory` stage, the processor should stall until the source operands are ready.

```verilog
branchstall = 
    BranchD and RegWriteE and (WriteRegE == rsD or WriteRegE == rtD)
    or
    BranchD and MemtoRegM and (WriteRegM == rsD or WriteRegM == rtD)
```

We now arrive at the complete logic:

```verilog
StallF = StallD = FlushE = lwstall or branchstall
```

### Summary

**A** `RAW` **data hazard occurs when an instruction depends on the result of another instruction that has not yet been written to the register file. If the result can be computed soon enough, the data hazard can be solved by forwarding; otherwise, the pipeline must be stalled until the result is available**.

**A control hazard occurs when the time comes to fetch the next instruction but the decision about which instruction to fetch has not yet been made. Control hazards are solved by predicting which instruction should be fetched and flushing the pipeline if the prediction later turns out to be wrong. Making the decision as early as possible minimizes the number of instructions flushed on a misprediction**.

By now, one of the challenges of designing a pipelined processor is understanding all the possible interactions among instructions and discovering all the hazards that may exist. The figure below shows the complete pipelined processor handling all of the hazards.

![whole](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404221913172.png)
