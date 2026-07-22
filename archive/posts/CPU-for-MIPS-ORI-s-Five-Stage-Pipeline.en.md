---
slug: CPU-for-MIPS-ORI-s-Five-Stage-Pipeline.en
title: 'CPU for MIPS: ORI''s Five-Stage Pipeline'
published: 2024-04-18
tags:
  - verilog
  - cpu
  - mips
  - five-stage
  - pipeline
category: architecture
lang: "en"
---
> In the CPU for MIPS series of notes, I will describe in detail how to build a complete five-stage pipeline step by step, starting from a minimal one (supporting $MIPS Release&#x2160;, so that $ucos$&#x2161; can be deployed on it).

## ORI Instruction

The figure below shows the instruction format of `ORI`:

![ori instruction type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181017833.png)

In other words, later on we need to use the encoding `001_101` to determine whether an instruction is of the `ori` type. At the same time, note that `ori` is an `I`-type instruction, which means it has an immediate value `imm`. In `MIPS`, `imm` is zero-extended — this is very important.

```asm
; ori的用法
ori rs, rt, imm
```

## A Simple Five-Stage Pipeline

In my previous article, I already introduced the concept of the pipeline in detail ([DDCA The Chapter 3 Reading, Parallelism](/en/2024/04/13/DDCA-The-Chapter-3-Reading/#Parallelism)), so I will not repeat it here. In this section, I mainly cover a complete, simple five-stage pipeline system for `ori`.

![origin data graph](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181036641.png)

As can be seen from the figure above, a five-stage pipeline is actually a process of five stages:

- Instruction Fetch
  - The fetch stage reads the instruction data corresponding to `pc` from the instruction memory, for use by the decode stage, after which `pc` increments itself.
  - Therefore, the two components involved here are `pc`, `inst_fetch_inst_decode`, and `inst_rom`
- Decode
  - The decode stage translates the instruction obtained from the fetch stage into binary data that the `cpu` can recognize. Therefore, at this stage, **we need to parse the instruction**, for example:
    - the type of the instruction
    - the registers the instruction needs to operate on (usually reading source registers and writing a destination register)
    - the data in the registers the instruction needs to operate on
    - whether the instruction contains an immediate value
    - ...
  - After obtaining the above data, send it to the execute stage for the `cpu` to actually execute
  - Therefore, the components involved here are `regfile`, `inst_decode`, and `inst_decode_execute`
- Execute
  - The execute stage performs the real execution based on the various data obtained from the decode stage, for example:
    - determine the operation type from the opcode obtained in the decode stage; this time the operation is `ori`, i.e., an OR operation
    - perform the OR operation with the source register data and destination register data obtained from the decode stage
    - then specify that the result be written into the destination register
  - The next step is the memory access stage
- Memory Access
  - This stage is usually required by instructions that read from or write to memory. Therefore, `ori` has no operation at this stage; it just passes the data from the execute stage down to the write back stage
- Write Back
  - Write back saves the computed result of the execution into the destination register

Therefore, what we mainly implement is a simple five-stage pipeline targeting the `ori` instruction.

## Concrete Implementation

Above, we have introduced the basic model of the five-stage pipeline; now it is time to implement each part in detail.

### Fetch Stage

The fetch stage requires us to read the corresponding instruction data from `inst_rom` according to `pc` and pass it to the decode stage. Therefore, at this stage we need to implement three modules: `pc`, `inst_rom`, and `inst_fetch`.

#### PC Module

The role of `pc` is to provide the current instruction address and prepare for the execution of the next instruction. The parameters corresponding to its interfaces are:

| Interface | Width | I/O | Function |
|:-------:| :---: | :---: | :---: |
|   rst   | 1 | i | reset signal |
|   clk   | 1 | i | clock signal |
| pc_addr | 32 | o | address of the instruction to read |
| inst_en | 1 | o | instruction memory enable signal |

```verilog
module pc(
    input   wire            rst,        // reset signal
    input   wire            clk,        // clock signal
    output  reg             inst_en,    // instruction memory enable signal
    output  reg     [31:0]  pc_addr     // need to get the address of pc 
    );
endmodule;
```

In the `pc` module, we only need to make two extremely simple checks (on the rising edge of the clock):

- If the reset signal is enabled, a reset is required; otherwise, assert the instruction memory enable signal
- If the instruction memory enable signal is not enabled, it means `pc` cannot be used, so give it an initial value; otherwise, increment it by `4`

```verilog
if (rst == `RST_ENABLE) ...
if (inst_en == `CHIP_DISABLE) ...
```

> Note:
> Why does `pc` increment by `4`? Because in `risc` instruction sets, an instruction is mandated to be `4` bytes long; common examples are `arm`, `mips`, and `risc-v`

The circuit diagram at this point is:

![pc circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181121963.png)

#### Instruction ROM Module

The role of `inst_rom` is to store the instructions that the system needs to execute; therefore, this module is only associated with `pc` for now.

| Interface | Width | I/O | Function |  
| :---: | :---: | :---: | :---: |  
| i_pc_en | 1 | i | instruction memory enable signal |  
| i_pc_addr | 31 | i | address of the current instruction |  
| o_pc_inst | 31 | o | instruction corresponding to the current instruction address |  

> One thing to clarify here:
> **The naming convention for interface names:**  
>> `i` indicates an input, `o` indicates an output  
>> The `pc` that follows indicates which module the signal comes from and which module it needs to be output to  
>> The last part is the information  
> In other words, the specific meaning of an interface name (taking `i_pc_en` as an example) is: an enable signal input coming from `pc`

```verilog
module rom_memory(
    input   wire                    i_pc_en,        // 从pc输入的使能信号
    input   wire [`INST_ADDR_BUS]   i_pc_addr,      // 从pc输入的指令地址
    output  reg [`INST_BUS]         o_fetch_inst    // 输出到fetch模块的指令
    );
endmodule;
```

In `inst_rom`, what we need to do is create a block of memory to hold the instruction data, and then fetch the instruction according to the corresponding `pc` address and enable signal. Therefore, the current circuit is:

![inst_rom](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181139643.png)

#### Fetch Module

The role of the `inst_fetch` module is to temporarily hold the data of the fetch stage and pass it to the decode stage on the next clock cycle.

|       Interface       | Width | I/O |                          Function                           |
|:------------------:|:--:|:-----:|:---------------------------:|
|        rst         | 1  |   i   |            reset signal            |
|        clk         | 1  |   i   |            clock signal             |
|      i_rom_pc      | 32 |   i   | instruction address obtained from the `inst_rom` module via `pc` |
|     i_rom_inst     | 32 |   i   |  instruction obtained from the `inst_rom` module via `pc`  |
|  o_inst_decode_pc  | 32 |   o   |        instruction address output to the decode stage         |
| o_inst_decode_inst | 32 |   o   |         instruction output to the decode stage          |

```verilog
module inst_fetch(
    input   wire                            rst,
    input   wire                            clk,
    input   wire    [`INST_ADDR_BUS]        i_rom_pc,               // the addr of the instruction attached in instruction fetch 
    input   wire    [`INST_BUS]             i_rom_inst,             // the instruction attached in instruction fetch
    output  reg     [`INST_ADDR_BUS]        o_inst_decode_pc,       // the addr of the instruction for instruction decode
    output  reg     [`INST_BUS]             o_inst_decode_inst      // the instruction for instruction decode
    );
endmodule;
```

In the `inst_fetch` module, we do not need to do any processing; it is equivalent to a relay station that sends the `pc` and `inst` data to the modules of the decode stage.

The following is the circuit diagram of the entire `fetch` module:

![fetch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181207668.png)

### Decode Stage

The decode stage needs to process the data from the fetch stage and then output it to the execute stage. Therefore, the decode stage involves the `regfile`, `inst_decode`, and `inst_decode_excute` modules.

#### Regfile Module

The `regfile` module is mainly used for the register file — that is, the registers we use in assembly. It can support two simultaneous register read operations and one register write operation.

|     Interface     | Width | I/O |      Function       |
|:-------------:|:--:|:-----:|:-------------:|
|      rst      | 1  |   i   |     reset signal      |
|      clk      | 1  |   i   |     clock signal      |
| i_w_reg_addr  | 5  |   i   |  address of the register to write   |
| i_w_reg_data  | 32 |   i   |  data of the register to write   |
|  i_w_reg_en   | 1  |   i   |     write enable signal     |
| i_r_reg_addr1 | 5  |   i   | address of the first register to read |
| i_r_reg_addr2 | 5  |   i   | address of the second register to read |
|  i_r_reg_en1  | 1  |   i   |   first read enable signal    |
|  i_r_reg_en2  | 1  |   i   |   second read enable signal    |
| o_r_reg_data1 | 32 | o | data of the first register read |
| o_r_reg_data2 | 32 | o | data of the second register read |

```verilog
module regfile(
    input   wire                        rst,
    input   wire                        clk,
    input   wire    [`REG_ADDR_BUS]     i_w_reg_addr,     // rd's addr
    input   wire    [`REG_BUS]          i_w_reg_data,     // rd's data
    input   wire    [`REG_ADDR_BUS]     i_r_reg_addr1,    // rs1's addr
    input   wire    [`REG_ADDR_BUS]     i_r_reg_addr2,    // rs2's addr
    input   wire                        i_w_reg_en,       // write rd enable
    input   wire                        i_r_reg_en1,      // read rs1 enable
    input   wire                        i_r_reg_en2,      // read rs2 enable
    output  reg     [`REG_BUS]          o_r_reg_data1,    // read rs1's data
    output  reg     [`REG_BUS]          o_r_reg_data2     // read rs2's data
    );
endmodule;
```

In the `regfile` module, we need to consider two cases: read and write:

- Write:
  - If `i_w_reg_en` is enabled and `i_w_reg_addr` is not `$0`, then write the corresponding `i_w_reg_data` into the register file
- Read:
  - There are four cases for reading:
    - Case 1: if the register that `rs1` (or `rs2`) needs to read is `$0`, directly assign `0` as the output
    - Case 2: if the register that `rs1` (or `rs2`) needs to read happens to be the register being written, directly output the value of the register being written
    - Case 3: if `rs1` (or `rs2`) is a plain read, output the value corresponding to `i_r_reg_addr` in the register
    - Case 4: in all other cases, assign `0` as the output

Since `regfile` is similar to a table module, the corresponding circuit is not given for now.

#### inst_decode Module

The role of the `inst_decode` module is to decode the instruction and obtain the final operation type, subtype, source operand 1, source operand 2, the address of the destination register to write, and other information.

|         Interface         | Width | I/O |             Function             |
|:---------------------:|:--:|:-----:|:--------------------------:|
|          rst          | 1  |   i   |            reset signal            |
|      i_fetch_pc       | 32 |   i   |    `pc` address obtained from the `fetch` module    |
|     i_fetch_inst      | 32 |   i   |      instruction obtained from the `fetch` module      |
|  i_regfile_reg_data1  | 32 |   i   | data of `reg1` queried from the `regfile` module |
|  i_regfile_reg_data2  | 32 |   i   | data of `reg2` queried from the `regfile` module |
|  o_regfile_r_reg_en1  | 1  |   o   |  read enable signal of `reg1` output to `regfile`  |
|  o_regfile_r_reg_en2  | 1  |   o   |  read enable signal of `reg2` output to `regfile`  |
| o_regfile_r_reg_addr1 | 5  |   o   |   address of `reg1` output to `regfile`   |
| o_regfile_r_reg_addr2 | 5  |   o   |   address of `reg2` output to `regfile`   |
|   o_execute_alu_op    | 8  |   o   |   subtype of the instruction output to the `execute` stage    |
|   o_execute_alu_sel   | 3  |   o   |    type of the instruction output to the `execute` stage    |
|  o_execute_reg_data1  | 32 |   o   |  data of `reg1` output to the `execute` stage  |
|  o_execute_reg_data2  | 32 |   o   |  data of `reg2` output to the `execute` stage  |
| o_execute_w_reg_addr  | 5  |   o   |   address of `rd` output to the `execute` stage   |
|  o_execute_w_reg_en   | 1  |   o   | write enable signal of `rd` output to the `execute` stage  |

```verilog
module inst_decode(
    input   wire                        rst,    
    input   wire    [`INST_ADDR_BUS]    i_fetch_pc,             //! the addr of the instruction whith need to be decoded
    input   wire    [`INST_BUS]         i_fetch_inst,           //! the instruction whith need to be decoded

    // read the regfile
    input   wire    [`REG_BUS]          i_regfile_reg_data1,    //! rs1's data
    input   wire    [`REG_BUS]          i_regfile_reg_data2,    //! rs2's data

    // output into regfile
    output  reg                         o_regfile_r_reg_en1,    //! the read enable signal for rs1 
    output  reg                         o_regfile_r_reg_en2,    //! the read enable signal for rs2
    output  reg     [`REG_ADDR_BUS]     o_regfile_r_reg_addr1,  //! the addr of rs1 which will be readed
    output  reg     [`REG_ADDR_BUS]     o_regfile_r_reg_addr2,  //! the addr of rs2 which will be readed

    // output into execution inst
    output  reg     [`ALU_OP_BUS]       o_execute_alu_op,       //! bit range operator code: logic、shift、algorithm
    output  reg     [`ALU_SEL_BUS]      o_execute_alu_sel,      //! small range operator code: and logic, or logic...
    output  reg     [`REG_BUS]          o_execute_reg_data1,    //! the rs1 which need to be calc
    output  reg     [`REG_BUS]          o_execute_reg_data2,    //! the rs2 which need to be calc
    output  reg     [`REG_ADDR_BUS]     o_execute_w_reg_addr,   //! the addr which need to be writen when calc done
    output  reg                         o_execute_w_reg_en      //! the write enable signal for rd
    );
endmodule;
```

Therefore, as can be seen, `inst_decode` parses the instruction and address obtained from the `fetch` module, then obtains the operand values of the corresponding registers as output by looking them up in the `regfile`; at the same time, it internally parses the meaning of each field of the instruction.

```text
// 31       26 25       21 20       16 15                   0
// ----------------------------------------------------------
//     ORI    |    rs    |     rd    |          imme
// ----------------------------------------------------------
//   001101   |          |           |
// ----------------------------------------------------------

// 31       26 25       21 20       16 15       11 10       6 5         0
// ----------------------------------------------------------------------
//     op     |     rs    |     rt    |     rd    |     sa   |   func   
// ----------------------------------------------------------------------
```

As shown above, the first one is the format of the `ori` instruction, and the one below is the common `R-type` instruction format. Therefore, if `rst` is deasserted, our initialization should be performed according to each field; by default we assume that `rs`, `rt`, and `rd` are present, i.e., a general `R-type` instruction.

Then we use `i_fetch_inst[21:26]` to extract the leading opcode. For now we only need to handle the `ori` instruction, so once an instruction is determined to be `ori`, the write enable is asserted, the instruction type is `logic`, and the subtype is `or logic`. Also, as known from the above, `ori` is an `I-type` instruction, so we assume the `rt` register is invalid and `rs` serves as the first operand. The `imm` is obtained directly by extracting `i_fetch_inst[15:0]` and then zero-extending it (**note, this is big-endian encoding**). We also need to set the `rd` register address and indicate that the instruction is valid.

After initialization is complete, we need to read `rs1` (or `rs2`, if valid) from the `regfile` table as the data of `o_execute_reg_data` output to the `execute` stage; if `rs1` (or `rs2`) is invalid, then the corresponding `o_execute_reg_data` should be the `imm` data.

![inst_decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181703512.png)

#### inst_decode_execute Module

This module is similar to the `fetch` module; it serves as the output relay station of the `inst_decode` module, used to send data to the `execute` module on the next clock cycle.

|          Interface            | Width | I/O |             Function              |
|:------------------------:|:--:|:-----:|:---------------------------:|
|           rst            | 1  |   i   |            reset signal             |
|           clk            | 1  |   i   |            clock signal             |
|  i_inst_decode_alu_sel   | 3  |   i   |       operation type information obtained from the decode stage        |
|   i_inst_decode_alu_op   | 8  |   i   |       sub-operation type information obtained from the decode stage       |
| i_inst_decode_reg_data1  | 32 |   i   |     data of the first source operand obtained from the decode stage      |
| i_inst_decode_reg_data2  | 32 |   i   |     data of the second source operand obtained from the decode stage      |
| i_inst_decode_w_reg_addr | 5  |   i   |       destination register address obtained from the decode stage       |
|  i_inst_decode_w_reg_en  | 1  |   i   |      destination register write enable obtained from the decode stage       |
|    o_execute_alu_sel     | 3  |   o   |    type information to be output to the `execute` stage    |
|     o_execute_alu_op     | 8  |   o   |   subtype information to be output to the `execute` stage    |
|   o_execute_reg_data1    | 32 |   o   |  data of the first operand to be output to the `execute` stage  |
|   o_execute_reg_data2    | 32 |   o   |  data of the second operand to be output to the `execute` stage  |
|   o_execute_w_reg_addr   | 5  |   o   | destination register address information to be output to the `execute` stage  |
|    o_execute_w_reg_en    | 1  |   o   | destination register write enable information to be output to the `execute` stage |

```verilog
module inst_decode_execute(
    input   wire                        rst,
    input   wire                        clk,

    input   wire    [`ALU_SEL_BUS]      i_inst_decode_alu_sel,
    input   wire    [`ALU_OP_BUS]       i_inst_decode_alu_op,
    input   wire    [`REG_BUS]          i_inst_decode_reg_data1,
    input   wire    [`REG_BUS]          i_inst_decode_reg_data2,
    input   wire    [`REG_ADDR_BUS]     i_inst_decode_w_reg_addr,
    input   wire                        i_inst_decode_w_reg_en,

    output  reg     [`ALU_SEL_BUS]      o_execute_alu_sel,
    output  reg     [`ALU_OP_BUS]       o_execute_alu_op,
    output  reg     [`REG_BUS]          o_execute_reg_data1,
    output  reg     [`REG_BUS]          o_execute_reg_data2,
    output  reg     [`REG_ADDR_BUS]     o_execute_w_reg_addr,
    output  reg                         o_execute_w_reg_en
    );
endmodule;
```

The logic here is extremely simple: on the next rising edge of the clock, forward the inputs as outputs to the `execute` module.

![instruction decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181724602.png)

### Execute Stage

In the decode stage, we have already obtained the first operand data, the second operand data, the instruction type, the instruction subtype, the destination register address, and the write enable of the destination register. Now we need to use the obtained data to implement the concrete operation.

#### execute Module

The `execute` module implements the operation of the corresponding type according to the information from the decode stage, and then produces the data that should be stored in the destination register.

|          Interface            | Width | O/I |             Function             |
|:------------------------:|:--:|:-----:|:--------------------------:|
|           rst            | 1  |   i   |            reset signal            |
|  i_inst_decode_alu_sel   | 3  |   i   |       computation subtype obtained from the decode stage        |
|   i_inst_decode_alu_op   | 8  |   i   |        computation type obtained from the decode stage        |
| i_inst_decode_reg_data1  | 32 |   i   |     data of the first source operand obtained from the decode stage     |
| i_inst_decode_reg_data2  | 32 |   i   |     data of the first source operand obtained from the decode stage     |
| i_inst_decode_w_reg_addr | 5  |   i   |      destination register address obtained from the decode stage       |
|  i_inst_decode_w_reg_en  | 1  |   i   |      destination register write enable obtained from the decode stage      |
|       o_w_reg_addr       | 5  |   o   | address of the destination register to be written after the `execute` module's computation |
|        o_w_reg_en        | 1  |   o   |  write enable of the destination register that the `execute` module needs to write  |
|       o_w_reg_data       | 32 |   o   |  data of the destination register that the `execute` module needs to write  |

```verilog
module execute(
    input   wire                    rst,
    input   wire  [`ALU_SEL_BUS]    i_inst_decode_alu_sel,
    input   wire  [`ALU_OP_BUS]     i_inst_decode_alu_op,
    input   wire  [`REG_BUS]        i_inst_decode_reg_data1,
    input   wire  [`REG_BUS]        i_inst_decode_reg_data2,
    input   wire  [`REG_ADDR_BUS]   i_inst_decode_w_reg_addr,
    input   wire                    i_inst_decode_w_reg_en,
    output  reg                     o_w_reg_en,
    output  reg   [`REG_ADDR_BUS]   o_w_reg_addr,
    output  reg   [`REG_BUS]        o_w_reg_data
    );
endmodule;
```

In the `execute` module, we need to compute the corresponding data according to the obtained subtype, and then, after determining `i_inst_decode_alu_sel`, output it through `o_w_reg_data`.

```verilog
case (i_inst_decode_alu_op)
  `EXE_OR_OP: begin
  end
  
case (i_inst_decode_alu_sel)
  `EXE_RES_LOGIC: begin
  end
```

![execute](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182017748.png)

#### execute_memory Module

This module is the relay station between the execute stage and the memory access stage, used to hand the output information from `execute` over to the `memory` module.

|        Interface          | Width | I/O |            Function            |
|:--------------------:|:--:|:-----:|:------------------------:|
|         rst          | 1  |   i   |           reset signal           |
|         clk          | 1  |   i   |           clock signal           |
| i_execute_w_reg_addr | 5  |   i   |  destination register address obtained from the `execute` module  |
|  i_execute_w_reg_en  | 1  |   i   | destination register write enable obtained from the `execute` module |
| i_execute_w_reg_data | 32 |   i   | destination register data computed in `execute` |
| o_memory_w_reg_addr  | 5  |   o   |       address to be written in the memory access stage        |
|  o_memory_w_reg_en   | 1  |   o   |        enable signal of the memory access stage         |
| o_memory_w_reg_data  | 32 |   o   |       data to be written in the memory access stage        |

```verilog
module execute_memory(
    input   wire                        rst,
    input   wire                        clk,
    input   wire                        i_execute_w_reg_en,
    input   wire    [`REG_ADDR_BUS]     i_execute_w_reg_addr,
    input   wire    [`REG_BUS]          i_execute_w_reg_data,
    output  reg                         o_memory_w_reg_en,
    output  reg     [`REG_ADDR_BUS]     o_memory_w_reg_addr,
    output  reg     [`REG_BUS]          o_memory_w_reg_data
    );
endmodule;
```

### Memory Access Stage

After the execute stage ends, the memory access stage should begin. However, the `ori` instruction does not involve any memory access operation, so we do not need to do anything; we simply pass the data to the write back stage.

#### memory Module

|          Interface No.           | Width | I/O |         Function          |
|:-----------------------:|:--:|:-----:|:-------------------:|
|           rst           | 1  |   i   |        reset signal         |
|  i_execute_w_reg_addr   | 5  |   i   |   destination register address obtained from the execute stage   |
|   i_execute_w_reg_en    | 1  |   i   |  destination register write enable obtained from the execute stage   |
|  i_execute_w_reg_data   | 32 |   i   |   destination register data obtained from the execute stage   |
| o_write_back_w_reg_addr | 5  |   o   |  destination register address output to the write back stage   |
|  o_write_back_w_reg_en  | 1  |   o   | destination register write enable signal output to the write back stage |
| o_write_back_w_reg_data | 32 |   o   |   destination register value output to the write back stage   |

In `ori`, there are no operations.

### Write Back Stage

The write back stage actually consists of two parts: one is the `memory_write_back` module, and the other is writing back to the `regfile` through this module.

#### memory write back Module

|        Interface          | Width | I/O |           Function            |
|:--------------------:|:--:|:-----:|:-----------------------:|
|         rst          | 1  |   i   |          reset signal           |
|         clk          | 1  |   i   |          clock signal           |
| i_memory_w_reg_addr  | 5  |   i   |     destination register address obtained from the memory access stage     |
|  i_memory_w_reg_en   | 1  |   i   |    destination register write enable obtained from the memory access stage     |
| i_memory_w_reg_data  | 32 |   i   |     destination register data obtained from the memory access stage     |
| o_regfile_w_reg_addr | 5  |   o   |  destination register address written back to the `regfile` module  |
|  o_regfile_w_reg_en  | 1  |   o   | destination register write enable written back to the `regfile` module |
| o_regfile_w_reg_data | 32 |   o   | destination register data written back to the `regfile` module  |

```verilog
module memory_write_back(
    input   wire                        rst,
    input   wire                        clk,
    input   wire                        i_memory_w_reg_en,
    input   wire    [`REG_ADDR_BUS]     i_memory_w_reg_addr,
    input   wire    [`REG_BUS]          i_memory_w_reg_data,
    output  reg                         o_regfile_w_reg_en,
    output  reg     [`REG_ADDR_BUS]     o_regfile_w_reg_addr,
    output  reg     [`REG_BUS]          o_regfile_w_reg_data
    );
endmodule;
```

### Building the Top-Level Module

So far, we have completed the five parts of the five-stage pipeline for `ori`; now it is time to wire them up through the top-level module.

![top-module](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182121621.png)

Each part is as follows:

![fetch stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182136329.png)
![decode stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182136278.png)
![execute stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137914.png)
![memory stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137828.png)
![write back stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137278.png)

Finally, we get the following circuit diagram:

![top-circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182134795.png)

......A century-long image indeed
