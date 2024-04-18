---
title: 'CPU for MIPS: ORI''s Five-Stage Pipeline'
mathjax: true
date: 2024-04-18 00:44:03
tags: [verilog, cpu, mips, five-stage pipeline]
categories: [architecture]
---

# The First instruction for ORI

> 在CPU for MIPS系列的笔记中，我会详细介绍从一个最小的五级流水线开始不断的构建出一个完整的五级流水线(支持`MIPS Realse &#x2160;`，从而将`ucos &#x2161;`进行搭载)。

## ORI Instruction

下图是`ORI`指令的类型格式：

![ori instruction type](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181017833.png)

也就是说，在后续，我们需要通过`001_101`这一编码来判断是否是`ori`类型；同时，也需要注意的是：`ori`是`I`型指令，也就是有一个立即数`imm`。在`MIPS`中，`imm`是无符号扩展的，这一点很重要。

```asm
; ori的用法
ori rs, rt, imm
```

## A Simple Five-Stage Pipeline

在我之间的文章中，已经详细介绍过流水线([DDCA The Chapter 3 Reading, Parallelism](https://chenmiaoi.github.io/2024/04/13/DDCA-The-Chapter-3-Reading/#Parallelism))的概念，因此就不再赘述。本节我主要讲述的是，关于`ori`的完备的，简单的五级流水线系统。

![origin data graph](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181036641.png)

由上图可以看见，五级流水线实际上就是五个阶段过程：

- 取指
  - 取指阶段是从指令存储器中取出`pc`所对应的指令数据，以供译指(译码)阶段使用，而后`pc`自增。
  - 因此，这里涉及的两个元件是`pc`、`inst_fetch_inst_decode`和`inst_rom`
- 译码
  - 译码阶段是要将从取指阶段得到的指令翻译成`cpu`能够识别的二进制数据。因此，在这一阶段，**我们需要对指令进行解析**，比如：
    - 指令的类型
    - 指令需要操作的寄存器(通常是读取源寄存器，写入目的寄存器)
    - 指令需要操作的寄存器中的数据
    - 指令中是否含有立即数
    - ...
  - 获得如上数据后，将这些数据送往执行阶段让`cpu`进行实际的执行
  - 因此，这里涉及的元件有`regfile`，`inst_decode`和`inst_decode_execute`
- 执行
  - 执行阶段是根据从译码阶段得到的各种数据，进行真实的执行，比如：
    - 从译码阶段获得的操作码判断操作类型，本次进行的是`ori`操作，也就是或操作
    - 通过从译码阶段得到的源寄存器数据和目的寄存器数据，进行或操作
    - 然后指定将结果写入目的寄存器中
  - 下一步便是访存阶段
- 访存
  - 对于这一阶段，通常是对内存进行读写操作的指令需要进行的。因此`ori`在此阶段并没有操作，将执行阶段的数据向下传递到回写阶段即可
- 回写
  - 回写将执行的计算结果保存到目的寄存器中

因此，我们主要实现的就是一个简单的针对`ori`指令的五级流水线。

## 具体实现

上面我们已经介绍了五级流水线的基本模型，现在，就应该具体来实现每一个部分了。

### 取指阶段

取指阶段要求我们根据`pc`从`inst_rom`中取出对应的指令数据，并传递给译码阶段。因此，这一阶段我们需要实现三个模块：`pc`、`inst_rom`和`inst_fetch`。

#### PC模块

`pc`的作用是给出当前指令地址，并准备下一条指令的执行。其接口对应的参数为:

|   接口名   | 宽度 | 输入/输出 | 作用 |
|:-------:| :---: | :---: | :---: |
|   rst   | 1 | i | 复位信号 |
|   clk   | 1 | i | 时钟信号 |
| pc_addr | 32 | o | 要读取的指令地址 |
| inst_en | 1 | o | 指令存储器使能信号 |

``` verilog
module pc(
    input   wire            rst,        // reset signal
    input   wire            clk,        // clock signal
    output  reg             inst_en,    // instruction memory enable signal
    output  reg     [31:0]  pc_addr     // need to get the address of pc 
    );
endmodule;
```

在`pc`模块中，我们只需要做两个极其简单的判断(在时钟上升沿时)：

- 如果复位信号是开启的，那么就需要重置；反之，则给指令存储器使能信号
- 如果指令存储器使能信号没有开启，就说明`pc`无法使用，则给一个初始值；反之，则需要累加`4`

``` verilog
if (rst == `RST_ENABLE) ...
if (inst_en == `CHIP_DISABLE) ...
```

> 注意：
> 为什么`pc`要累加`4`呢？因此在`risc`指令集中，一条指令被强制规定为`4`字节的，常见的有`arm`、`mips`和`risc-v`

此时的电路图为：

![pc circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181121963.png)

#### Instruction ROM模块

`inst_rom`的作用是存储系统中需要执行的指令，因此，该模块只与`pc`暂时相关联。

| 接口名 | 宽度 | 输入/输出 | 作用 |  
| :---: | :---: | :---: | :---: |  
| i_pc_en | 1 | i | 指令存储器使能信号 |  
| i_pc_addr | 31 | i | 当前指令的地址 |  
| o_pc_inst | 31 | o | 当前指令地址对应的指令 |  

> 这里需要说明的是：
> **接口名的命名规范问题：**  
>> `i`表示输入，`o`表示输出  
>> 紧接着的`pc`就是从什么地方输入过来的信号，需要输出到哪一个模块去  
>> 最后的是信息  
> 也就是说，接口名具体意义是(以`i_pc_en`为例)：从`pc`过来的使能信号输入  

``` verilog
module rom_memory(
    input   wire                    i_pc_en,        // 从pc输入的使能信号
    input   wire [`INST_ADDR_BUS]   i_pc_addr,      // 从pc输入的指令地址
    output  reg [`INST_BUS]         o_fetch_inst    // 输出到fetch模块的指令
    );
endmodule;
```

在`inst_rom`中，我们需要做的就是创建一块内存用于保存指令数据，然后根据对应的`pc`地址和使能信号取出指令。因此，当前的电路为：

![inst_rom](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181139643.png)

#### Fetch模块

`inst_fetch`模块的作用是暂时保存取指阶段的数据，并在下一个时钟传递给译码阶段。

|        接口名         | 宽度 | 输入/输出 |             作用              |
|:------------------:|:--:|:-----:|:---------------------------:|
|        rst         | 1  |   i   |            复位信号             |
|        clk         | 1  |   i   |            时钟信号             |
|      i_rom_pc      | 32 |   i   | 通过`pc`从`inst_rom`模块中获得的指令地址 |
|     i_rom_inst     | 32 |   i   |  通过`pc`从`inst_rom`模块中获得的指令  |
|  o_inst_decode_pc  | 32 |   o   |        输出到译码阶段的指令地址         |
| o_inst_decode_inst | 32 |   o   |         输出到译码阶段的指令          |

``` verilog
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

在`inst_fetch`模块中，我们不需要做任何处理，这就相当于一个中转站，将`pc`和`inst`数据发送给译码阶段的模块。

如下就是整个`fetch`模块的电路图:

![fetch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181207668.png)

### 译码阶段

译码阶段需要将取指阶段的数据进行处理，然后输出到执行阶段，因此，译码阶段涉及`regfile`、`inst_decode`和`inst_decode_excute`模块。

#### Regfile模块

`regfile`模块主要是用于寄存器表，也就是汇编中我们使用的寄存器，其可以同时支持两个寄存器的读操作和一个寄存器的写操作。

|      接口名      | 宽度 | 输入/输出 |      作用       |
|:-------------:|:--:|:-----:|:-------------:|
|      rst      | 1  |   i   |     复位信号      |
|      clk      | 1  |   i   |     时钟信号      |
| i_w_reg_addr  | 5  |   i   |  需要写入的寄存器地址   |
| i_w_reg_data  | 32 |   i   |  需要写入的寄存器数据   |
|  i_w_reg_en   | 1  |   i   |     写使能信号     |
| i_r_reg_addr1 | 5  |   i   | 第一个需要读取的寄存器地址 |
| i_r_reg_addr2 | 5  |   i   | 第二个需要读取的寄存器地址 |
|  i_r_reg_en1  | 1  |   i   |   第一个读使能信号    |
|  i_r_reg_en2  | 1  |   i   |   第二个读使能信号    |
| o_r_reg_data1 | 32 | o | 被读取的第一个寄存器数据 |
| o_r_reg_data2 | 32 | o | 被读取的第二个寄存器数据 |

``` verilog
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

在`regfile`模块中，我们需要考虑两种情况，读和写：

- 写：
  - 如果`i_w_reg_en`是开启的，且`i_w_reg_addr`不为`$0`，那么就将对应的`i_w_reg_data`写入到寄存器表中
- 读：
  - 读有四种情况：
    - 第一种：如果`rs1`(或`rs2`)需要读的寄存器为`$0`，那么直接赋值为`0`进行输出
    - 第二种：如果`rs1`(或`rs2`)需要读的寄存器刚好是写寄存器，那么直接将写寄存器的值赋值进行输出
    - 第三种：如果`rs1`(或`rs2`)单纯的读，那么将在寄存器中`i_r_reg_addr`对应的值赋值进行输出
    - 第四种：其他情况均赋值为`0`进行输出

由于`regfile`类似于表模块，因此暂时不给出对应的电路。

#### inst_decode模块

`inst_decode`模块的作用是对指令进行译码，得到最终的运算类型、子类型、源操作数1、源操作数2和要写入的目的寄存器地址等信息。

|          接口名          | 宽度 | 输入/输出 |             作用             |
|:---------------------:|:--:|:-----:|:--------------------------:|
|          rst          | 1  |   i   |            复位信号            |
|      i_fetch_pc       | 32 |   i   |    从`fetch`模块中得到的`pc`地址    |
|     i_fetch_inst      | 32 |   i   |      从`fetch`模块中得到的指令      |
|  i_regfile_reg_data1  | 32 |   i   | 从`regfile`模块中查询到的`reg1`的数据 |
|  i_regfile_reg_data2  | 32 |   i   | 从`regfile`模块中查询到的`reg2`的数据 |
|  o_regfile_r_reg_en1  | 1  |   o   | 输出到`regfile`的`reg1`的读使能信号  |
|  o_regfile_r_reg_en2  | 1  |   o   | 输出到`regfile`的`reg2`的读使能信号  |
| o_regfile_r_reg_addr1 | 5  |   o   |   输出到`regfile`的`reg1`的地址   |
| o_regfile_r_reg_addr2 | 5  |   o   |   输出到`regfile`的`reg2`的地址   |
|   o_execute_alu_op    | 8  |   o   |   输出到`execute`阶段的指令的子类型    |
|   o_execute_alu_sel   | 3  |   o   |    输出到`execute`阶段的指令的类型    |
|  o_execute_reg_data1  | 32 |   o   |  输出到`execute`阶段的`reg1`的数据  |
|  o_execute_reg_data2  | 32 |   o   |  输出到`execute`阶段的`reg2`的数据  |
| o_execute_w_reg_addr  | 5  |   o   |   输出到`execute`阶段的`rd`的地址   |
|  o_execute_w_reg_en   | 1  |   o   | 输出到`execute`阶段的`rd`的写使能信号  |

``` verilog
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

因此，可以看见，`inst_decode`会从`fetch`模块中得到的指令和地址进行解析，然后通过访问`regfile`查表操作，获得对应寄存器的操作数值作为输出；同时，在内部解析指令每一个字段含义。

``` text
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

如上所示，第一个是`ori`指令的格式，而下面的是常见的`R-type`指令格式。因此，如果`rst`是关闭的，我们的初始化应该需要根据每个字段进行初始化，我们默认`rs`、`rt`和`rd`是存在的，也就是一般意义的`R-type`指令。

然后我们通过`i_fetch_inst[21:26]`来截取最开始的操作码，目前我们只需要判断`ori`指令，因此，一旦判断是`ori`指令后，写使能开启，指令类型是`logic`，子类型是`or logic`；又从上面可以知道`ori`是`I-type`指令，因此我们假设`rt`寄存器无效，`rs`作为第一个操作数。而`imm`直接由`i_fetch_inst[15:0]`截取后进行无符号扩展(**注意，这里是大端编码**)，然后还需要设置`rd`寄存器地址，并指出该指令有效。

初始化完成后，我们就需要去`regfile`表中读取`rs1(或rs2，如果有效的话)`作为`o_execute_reg_data`的数据输出到`execute`阶段，如果`rs1(或rs2)`是无效的，那么对应的`o_execute_reg_data`就应该是`imm`的数据。

![inst_decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181703512.png)

#### inst_decode_execute模块

这个模块和`fetch`模块类似，是作为`inst_decode`模块的输出中转站，用以在下一个时钟送往`execute`模块的。

|           接口名            | 宽度 | 输入/输出 |             作用              |
|:------------------------:|:--:|:-----:|:---------------------------:|
|           rst            | 1  |   i   |            复位信号             |
|           clk            | 1  |   i   |            时钟信号             |
|  i_inst_decode_alu_sel   | 3  |   i   |       从译码阶段获取的运算类型信息        |
|   i_inst_decode_alu_op   | 8  |   i   |       从译码阶段获取的子运算类型信息       |
| i_inst_decode_reg_data1  | 32 |   i   |     从译码阶段获取的第一个源操作数的数据      |
| i_inst_decode_reg_data2  | 32 |   i   |     从译码阶段获取的第二个源操作数的数据      |
| i_inst_decode_w_reg_addr | 5  |   i   |       从译码阶段获取的目的寄存器地址       |
|  i_inst_decode_w_reg_en  | 1  |   i   |      从译码阶段获取的目的寄存器写使能       |
|    o_execute_alu_sel     | 3  |   o   |    将要输出到`execute`阶段的类型信息    |
|     o_execute_alu_op     | 8  |   o   |   将要输出到`execute`阶段的子类型信息    |
|   o_execute_reg_data1    | 32 |   o   |  将要输出到`execute`阶段的第一个操作数数据  |
|   o_execute_reg_data2    | 32 |   o   |  将要输出到`execute`阶段的第二个操作数数据  |
|   o_execute_w_reg_addr   | 5  |   o   | 将要输出到`execute`阶段的目的寄存器地址信息  |
|    o_execute_w_reg_en    | 1  |   o   | 将要输出到`execute`阶段的目的寄存器写使能信息 |

``` verilog
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

这里的逻辑极其简单，就是在下一个时钟上升沿时，将输入的输出转交给`execute`模块即可。

![instruction decode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404181724602.png)

### 执行阶段

我们已经在译码阶段得到了第一个操作数数据、第二个操作数数据、指令类型、指令子类型、目的寄存器地址和目的寄存器的写使能。现在就需要通过获得的数据来进行具体的操作实现了。

#### execute模块

`execute`模块会根据译码阶段的信息，来实现对应类型的操作，然后得出应该存在目的寄存器中的数据。

|           接口名            | 宽度 | 输出/输入 |             作用             |
|:------------------------:|:--:|:-----:|:--------------------------:|
|           rst            | 1  |   i   |            复位信号            |
|  i_inst_decode_alu_sel   | 3  |   i   |       从译码阶段得到的计算子类型        |
|   i_inst_decode_alu_op   | 8  |   i   |        从译码阶段得到的计算类型        |
| i_inst_decode_reg_data1  | 32 |   i   |     从译码阶段得到的第一个源操作数的数据     |
| i_inst_decode_reg_data2  | 32 |   i   |     从译码阶段得到的第一个源操作数的数据     |
| i_inst_decode_w_reg_addr | 5  |   i   |      从译码阶段得到的目的寄存器地址       |
|  i_inst_decode_w_reg_en  | 1  |   i   |      从译码阶段得到的目的寄存器写使能      |
|       o_w_reg_addr       | 5  |   o   | `execute`模块计算后需要写入的目的寄存器地址 |
|        o_w_reg_en        | 1  |   o   | `execute`模块需要写入的目的寄存器的写使能  |
|       o_w_reg_data       | 32 |   o   |  `execute`模块需要写入的目的寄存器的数据  |

``` verilog
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

在`execute`模块中，我们需要根据得到的子类型来计算对应的数据，然后判断`i_inst_decode_alu_sel`后通过`o_w_reg_data`进行输出。

``` verilog
case (i_inst_decode_alu_op)
  `EXE_OR_OP: begin
  end
  
case (i_inst_decode_alu_sel)
  `EXE_RES_LOGIC: begin
  end
```

![execute](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182017748.png)

#### execute_memory模块

该模块是执行阶段和访存阶段之间的中转站，用于将`execute`中的输出信息转交给`memory`模块。

|         接口名          | 宽度 | 输入/输出 |            作用            |
|:--------------------:|:--:|:-----:|:------------------------:|
|         rst          | 1  |   i   |           复位信号           |
|         clk          | 1  |   i   |           时钟信号           |
| i_execute_w_reg_addr | 5  |   i   | 从`execute`模块得到的目的寄存器的地址  |
|  i_execute_w_reg_en  | 1  |   i   | 从`execute`模块得到的目的寄存器的写使能 |
| i_execute_w_reg_data | 32 |   i   | 从`execute`中计算得到的目的寄存器的数据 |
| o_memory_w_reg_addr  | 5  |   o   |       访存阶段将要写入的地址        |
|  o_memory_w_reg_en   | 1  |   o   |        访存阶段的使能信号         |
| o_memory_w_reg_data  | 32 |   o   |       访存阶段将要写入的数据        |

``` verilog
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

### 访存阶段

当执行阶段结束后，就应该进入访存阶段了，但是，`ori`指令并不涉及访存操作，因此我们不需要做任何事，直接将数据传给回写阶段即可。

#### memory模块

|           接口号           | 宽度 | 输入/输出 |         作用          |
|:-----------------------:|:--:|:-----:|:-------------------:|
|           rst           | 1  |   i   |        复位信号         |
|  i_execute_w_reg_addr   | 5  |   i   |   从执行阶段得到的目的寄存器地址   |
|   i_execute_w_reg_en    | 1  |   i   |  从执行阶段得到的目的寄存器写使能   |
|  i_execute_w_reg_data   | 32 |   i   |   从执行阶段得到的目的寄存器数据   |
| o_write_back_w_reg_addr | 5  |   o   |  输出到写回阶段的目的寄存器的地址   |
|  o_write_back_w_reg_en  | 1  |   o   | 输出到写回阶段的目的寄存器的写使能信号 |
| o_write_back_w_reg_data | 32 |   o   |   输出到写回阶段的目的寄存器的值   |

在`ori`中，没有任何操作。

### 回写阶段

回写阶段实际上是两部分组成，一个是`memory_write_back`模块，一个就是通过该模块回写到`regfile`中。

#### memory write back模块

|         接口名          | 宽度 | 输入/输出 |           作用            |
|:--------------------:|:--:|:-----:|:-----------------------:|
|         rst          | 1  |   i   |          复位信号           |
|         clk          | 1  |   i   |          时钟信号           |
| i_memory_w_reg_addr  | 5  |   i   |     从访存阶段得到的目的寄存器地址     |
|  i_memory_w_reg_en   | 1  |   i   |    从访存阶段得到的目的寄存器写使能     |
| i_memory_w_reg_data  | 32 |   i   |     从访存阶段得到的目的寄存器数据     |
| o_regfile_w_reg_addr | 5  |   o   | 回写到`regfile`模块的目的寄存器地址  |
|  o_regfile_w_reg_en  | 1  |   o   | 回写到`regfile`模块的目的寄存器写使能 |
| o_regfile_w_reg_data | 32 |   o   | 回写到`regfile`模块的目的寄存器数据  |

``` verilog
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

### 顶层模块构建

目前，我们已经完成了`ori`的五级流水线的五个部分，现在就应该通过顶层模块来布线了。

![top-module](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182121621.png)

每一个部分分别为：

![fetch stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182136329.png)
![decode stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182136278.png)
![execute stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137914.png)
![memory stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137828.png)
![write back stage](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182137278.png)

最终我们得到如下电路图：

![top-circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404182134795.png)

......世纪长图