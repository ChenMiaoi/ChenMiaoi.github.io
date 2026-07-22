---
title: Verilog 语法入门：从第一个模块到可综合 RTL
published: 2026-07-22T22:07:58+08:00
description: 从零开始学习 Verilog，理解模块、信号、组合逻辑、时序逻辑、数组和有限状态机，并用一个简单计数器建立 RTL 思维。
image: ''
tags:
  - RISC-V
  - Verilog
  - RTL
  - 硬件设计
category: hardware-language
series: riscv-verilog-syntax
seriesOrder: 1
---

如果你第一次接触 Verilog，最容易产生的误会是：它看起来像 C，但运行方式完全不同。

C 程序是一条语句接着一条语句执行。Verilog 描述的是电路。多个模块可以同时工作，`assign` 描述连线，`always` 描述一段组合逻辑或时序逻辑。写代码之前，先问一句：这段代码最后会变成什么硬件？

本文不从语法表开始，而是从一个能运行的模块开始。后面每一章都围绕同一个小电路展开。

```text
输入 a、b ──> 组合逻辑 ──> 输出 y
                 │
时钟 clk ─────> 寄存器 ─────> q
```

## 1. 第一个模块

Verilog 的基本单位是 `module`。它有输入端口、输出端口和内部实现。

```verilog
module and_gate (
    input  wire a,
    input  wire b,
    output wire y
);
    assign y = a & b;
endmodule
```

`module and_gate` 定义了一个名为 `and_gate` 的模块。`a` 和 `b` 是输入，`y` 是输出。`assign y = a & b;` 表示 `y` 始终连接到 `a & b` 的结果。

这里的 `assign` 不会只执行一次。只要 `a` 或 `b` 变化，`y` 就会跟着变化。

## 2. wire、reg 和 logic

传统 Verilog 常见两种信号类型：

- `wire` 表示连线，通常由 `assign` 或其他模块的输出驱动；
- `reg` 表示可以在 `always` 块中赋值的变量。

```verilog
module add_one (
    input  wire [7:0] a,
    output reg  [7:0] y
);
    always @(*) begin
        y = a + 8'd1;
    end
endmodule
```

`[7:0]` 表示 8 位信号，最高位是 7，最低位是 0。`8'd1` 表示一个 8 位十进制数 1。

如果工具支持 SystemVerilog，通常可以用 `logic` 代替 `wire` 和 `reg`，并使用 `always_comb`、`always_ff`。不过理解 `wire` 和 `reg` 有助于读老项目和很多 RISC-V RTL 代码。

## 3. 组合逻辑：输出只由当前输入决定

组合逻辑没有记忆。输入相同，输出就相同。

```verilog
module alu_add_sub (
    input  wire [31:0] a,
    input  wire [31:0] b,
    input  wire        sub,
    output reg  [31:0] y
);
    always @(*) begin
        if (sub)
            y = a - b;
        else
            y = a + b;
    end
endmodule
```

`always @(*)` 的意思是：当这个块读取的输入变化时，重新计算一次。组合逻辑中，输出在每个分支都必须被赋值，否则综合工具可能推导出锁存器。

不推荐这样写：

```verilog
always @(*) begin
    if (enable)
        y = a;
end
```

当 `enable` 为 0 时，`y` 没有新值。硬件为了保留旧值，可能生成 latch。更安全的写法是先给默认值：

```verilog
always @(*) begin
    y = 32'b0;
    if (enable)
        y = a;
end
```

### 位宽和拼接

Verilog 会按位宽进行运算，位宽不清楚时很容易得到意外结果。

```verilog
wire [7:0]  low;
wire [7:0]  high;
wire [15:0] value;

assign value = {high, low};
```

`{high, low}` 是拼接，结果是 16 位。`value[15:8]` 是高 8 位，`value[7:0]` 是低 8 位。

常用写法还有：

```verilog
assign next_pc = pc + 32'd4;
assign is_zero = (result == 32'b0);
assign sign    = result[31];
```

## 4. 时序逻辑：在时钟边沿保存状态

寄存器需要时钟。最常见的写法是在上升沿更新：

```verilog
module register32 (
    input  wire        clk,
    input  wire        reset,
    input  wire [31:0] d,
    output reg  [31:0] q
);
    always @(posedge clk) begin
        if (reset)
            q <= 32'b0;
        else
            q <= d;
    end
endmodule
```

这里有两个重点：

1. `posedge clk` 表示只在时钟上升沿执行；
2. 时序逻辑通常使用非阻塞赋值 `<=`。

阻塞赋值 `=` 更适合组合逻辑。非阻塞赋值会让同一个时钟沿上的寄存器同时更新，这正是硬件寄存器组的行为。

```text
时钟上升沿：

d ──> [寄存器 q] ──> q
       在此刻采样
```

同步复位和异步复位写法不同。上面的 `reset` 只有在时钟沿到来时才生效，是同步复位。异步复位通常写成：

```verilog
always @(posedge clk or posedge reset) begin
    if (reset)
        q <= 32'b0;
    else
        q <= d;
end
```

项目中应统一复位风格，不要在同一个设计里随意混用。

## 5. 用 always_comb 和 always_ff 写 SystemVerilog

现在的新项目通常使用 SystemVerilog：

```text
module register32 (
    input  logic        clk,
    input  logic        reset,
    input  logic [31:0] d,
    output logic [31:0] q
);
    always_ff @(posedge clk) begin
        if (reset)
            q <= 32'b0;
        else
            q <= d;
    end
endmodule
```

组合逻辑可以写成：

```text
always_comb begin
    y = a + b;
end
```

`always_comb` 和 `always_ff` 会让工具更容易检查你的意图。学习老代码时仍会遇到 `always @(*)` 和 `always @(posedge clk)`，它们对应的是同一类硬件。

## 6. 模块例化：把电路组合起来

一个模块可以使用另一个模块。下面把两个半加器组合成一个全加器的结构形式：

```verilog
module top (
    input  wire a,
    input  wire b,
    output wire y
);
    and_gate u_and (
        .a(a),
        .b(b),
        .y(y)
    );
endmodule
```

`.a(a)` 左边是子模块端口，右边是当前模块的信号。建议使用这种按名字连接的写法。按位置连接虽然短，但端口一多就容易接错。

## 7. 数组：寄存器堆的基础

RISC-V CPU 需要寄存器堆。用 Verilog 可以先写一个非常小的版本：

```verilog
module regfile (
    input  wire        clk,
    input  wire        we,
    input  wire [4:0]  waddr,
    input  wire [31:0] wdata,
    input  wire [4:0]  raddr1,
    input  wire [4:0]  raddr2,
    output wire [31:0] rdata1,
    output wire [31:0] rdata2
);
    reg [31:0] regs [0:31];

    assign rdata1 = (raddr1 == 5'd0) ? 32'b0 : regs[raddr1];
    assign rdata2 = (raddr2 == 5'd0) ? 32'b0 : regs[raddr2];

    always @(posedge clk) begin
        if (we && waddr != 5'd0)
            regs[waddr] <= wdata;
    end
endmodule
```

`reg [31:0] regs [0:31]` 是 32 个 32 位元素。这里假设 x0 永远为 0，所以写入 x0 会被忽略，读取 x0 直接返回 0。

这个例子也展示了组合读、时序写的常见寄存器堆结构。

## 8. 有限状态机

有限状态机通常由三部分组成：状态寄存器、下一状态逻辑、输出逻辑。

```text
       +----------------+
输入 ->| 下一状态逻辑   |-> next_state
       +----------------+       |
                                v
                         +--------------+
时钟 ------------------->| 状态寄存器   |-> state
                         +--------------+
```

下面是一个简单的两状态 FSM：

```text
module simple_fsm (
    input  logic clk,
    input  logic reset,
    input  logic start,
    output logic busy
);
    typedef enum logic {IDLE, RUN} state_t;
    state_t state, next_state;

    always_comb begin
        next_state = state;
        case (state)
            IDLE: if (start) next_state = RUN;
            RUN:             next_state = IDLE;
            default:         next_state = IDLE;
        endcase
    end

    always_ff @(posedge clk) begin
        if (reset)
            state <= IDLE;
        else
            state <= next_state;
    end

    assign busy = (state == RUN);
endmodule
```

`case` 的每个状态都应该有明确处理。`default` 可以让未知状态回到安全状态，也能帮助综合和仿真检查问题。

## 9. 测试平台不是硬件

testbench 用来驱动输入、检查输出，它不会被综合成芯片电路。

```verilog
module tb;
    reg clk = 0;
    reg reset = 1;
    reg [31:0] d = 0;
    wire [31:0] q;

    register32 dut (
        .clk(clk), .reset(reset), .d(d), .q(q)
    );

    always #5 clk = ~clk;

    initial begin
        #12 reset = 0;
        #10 d = 32'd42;
        #10;
        $display("q = %0d", q);
        $finish;
    end
endmodule
```

`#5` 是仿真延时，`$display` 和 `$finish` 也是仿真语句。它们不能直接当作 RTL 写进可综合模块。

## 10. 写 Verilog 时先画电路

初学时，我建议每写一个 `always` 块就画一张小图：

- 这个块读取哪些信号？
- 它是否有时钟？
- 输出是连线、组合结果，还是寄存器？
- 每条路径是否都给输出赋值？
- 位宽是否一致？

如果这几个问题能回答清楚，语法通常不是最难的部分。真正需要练习的是把代码和电路一一对应起来。

接下来可以用 Verilog 写一个 ALU、寄存器堆，再把它们连接成单周期 RISC-V 数据通路。Chisel 和 BSV 文章会用尽量相同的模块继续比较三种语言的写法。

## 11. Verilog 的词法和基本写法

Verilog 的注释有两种：

```verilog
// 单行注释
/* 多行注释 */
```

标识符通常由字母、数字、下划线和 `$` 组成，但不能以数字开头。Verilog 区分大小写，`data`、`Data` 和 `DATA` 是三个名字。

### 数字常量

数字常量的格式是 `位宽'进制数值`：

```verilog
8'b1010_0101   // 二进制
8'hA5          // 十六进制
12'd100        // 十进制
8'o377         // 八进制
32'b0          // 32 位零
```

下划线只用于提高可读性。除了 0 和 1，Verilog 还允许 `x` 表示未知值、`z` 表示高阻态：

```verilog
4'b10xz
8'bz
```

仿真时不要随意忽略 `x`。一个地址或控制信号出现未知值，通常说明复位、连接或赋值路径有问题。

### 参数和 localparam

参数让同一个模块可以适配不同位宽：

```verilog
module adder #(parameter WIDTH = 32) (
    input  wire [WIDTH-1:0] a,
    input  wire [WIDTH-1:0] b,
    output wire [WIDTH-1:0] y
);
    assign y = a + b;
endmodule
```

`parameter` 可以在例化时覆盖，`localparam` 只能在模块内部使用，适合表示不会被外部修改的常量。

```verilog
localparam OPCODE_WIDTH = 7;
```

## 12. 运算符

Verilog 的运算符大致分为以下几类：

```verilog
assign sum  = a + b;
assign diff = a - b;
assign mask = a & b;
assign flag = (a == b);
assign pick = enable ? a : b;
```

- 算术：`+`、`-`、`*`、`/`、`%`；
- 位运算：`&`、`|`、`^`、`~`；
- 逻辑运算：`&&`、`||`、`!`；
- 比较：`==`、`!=`、`<`、`<=`、`>`、`>=`；
- 移位：`<<`、`>>`、`<<<`、`>>>`；
- 选择：`condition ? left : right`。

`&` 是逐位与，`&&` 是逻辑与。`==` 在存在 `x/z` 时可能得到未知结果；验证代码中经常用 `===` 和 `!==` 进行包含未知值的比较。

```verilog
assign y = a & b;       // 每一位分别进行 AND
assign ok = valid && ready; // 把两个信号当作条件
```

## 13. 阻塞赋值和非阻塞赋值

这是 Verilog RTL 最重要的语法区别之一。

```verilog
always @(*) begin
    tmp = a + b;
    y   = tmp;
end
```

组合逻辑通常使用阻塞赋值 `=`，语句按顺序计算。时序逻辑通常使用非阻塞赋值 `<=`：

```verilog
always @(posedge clk) begin
    q1 <= d;
    q2 <= q1;
end
```

这个电路中，`q2` 每个周期取得的是旧的 `q1`，因此形成两级寄存器。不要为了“让代码看起来顺序执行”把时序寄存器改成阻塞赋值。

## 14. if、case 和优先级

组合逻辑的条件语句：

```verilog
always @(*) begin
    y = 32'b0;
    if (sel == 2'd0)
        y = a;
    else if (sel == 2'd1)
        y = b;
    else
        y = c;
end
```

`if` 从上到下判断，多个条件同时成立时，靠前的分支优先。

```verilog
always @(*) begin
    y = 32'b0;
    case (opcode)
        7'b0110011: y = r_type_result;
        7'b0010011: y = i_type_result;
        default:    y = 32'b0;
    endcase
end
```

`casez` 可以把 `z` 和 `?` 当作不关心位，`casex` 会把 `x` 也当作不关心位。RTL 中通常应谨慎使用 `casex`，因为它可能掩盖仿真中的未知值。

SystemVerilog 还提供 `unique case` 和 `priority case`，用来表达互斥或有优先级的意图。

## 15. 连接、切片和数组

信号可以选择单个位、连续切片和不连续拼接：

```verilog
wire [31:0] instruction;
wire [6:0]  opcode = instruction[6:0];
wire [4:0]  rd     = instruction[11:7];
wire [31:0] upper  = {20'b0, instruction[31:20]};
```

多维数组适合描述存储器：

```verilog
reg [7:0] memory [0:255];

always @(posedge clk) begin
    if (we)
        memory[waddr] <= wdata;
end

assign rdata = memory[raddr];
```

`memory` 有 256 个元素，每个元素 8 位。左边的 `[7:0]` 是元素宽度，右边的 `[0:255]` 是索引范围。

## 16. function 和 task

`function` 用于组合计算，并且只能返回一个值：

```verilog
function [31:0] sign_extend_12;
    input [11:0] imm;
    begin
        sign_extend_12 = {{20{imm[11]}}, imm};
    end
endfunction

assign immediate = sign_extend_12(instruction[31:20]);
```

`task` 可以有多个输出，也可以包含仿真时序，常用于 testbench。不要把带 `#` 延时的 task 当作可综合 RTL。

## 17. generate 和条件生成

`generate` 在 elaboration 阶段复制或选择硬件结构：

```verilog
genvar i;
generate
    for (i = 0; i < 8; i = i + 1) begin : gen_xor
        assign y[i] = a[i] ^ b[i];
    end
endgenerate
```

`generate if` 可以根据参数选择结构：

```verilog
generate
    if (WIDTH == 32) begin
        // 32 位实现
    end else begin
        // 其他位宽实现
    end
endgenerate
```

循环展开和运行时循环不是一回事。`generate for` 生成固定数量的硬件，不能由运行时信号决定循环次数。

## 18. module、include 和 package

大型项目通常把模块拆成多个文件。`` `include `` 会把另一个文件的文本插入当前位置：

```verilog
`include "defines.vh"
```

宏用反引号开头：

```verilog
`define XLEN 32
```

SystemVerilog 的 `package` 更适合管理共享类型和常量：

```systemverilog
package riscv_types;
    typedef enum logic [2:0] {
        ALU_ADD, ALU_SUB, ALU_AND
    } alu_op_t;
endpackage

module alu (...);
    import riscv_types::*;
    alu_op_t op;
endmodule
```

## 19. 常用 SystemVerilog 类型

SystemVerilog 可以用 `typedef` 给复杂类型起名字：

```systemverilog
typedef struct packed {
    logic [31:0] pc;
    logic [31:0] instruction;
    logic        valid;
} fetch_packet_t;
```

`packed struct` 会按位连续排列，适合流水线寄存器和接口。枚举适合状态机：

```systemverilog
typedef enum logic [1:0] {IDLE, BUSY, DONE} state_t;
state_t state;
```

`interface` 可以把一组握手信号放在一起，但初学阶段先把普通 module 端口读熟，再学习 modport 和 interface，会更容易定位连接方向。

## 20. 仿真系统任务和断言

testbench 中常见的系统任务：

```verilog
$display("pc = %h", pc);
$monitor("time=%0t valid=%b", $time, valid);
$finish;
```

SystemVerilog 断言可以把协议写成可检查的条件：

```systemverilog
assert property (@(posedge clk) disable iff (reset)
    valid && ready |=> data_accepted
);
```

这类断言不是硬件数据通路，但对检查流水线、FIFO 和总线协议很有帮助。

## 21. 一份 RTL 代码检查表

写完 Verilog 后，至少检查这些问题：

1. 组合逻辑的每条路径是否都给输出赋值？
2. 时序逻辑是否使用 `posedge` 和非阻塞赋值？
3. 一个寄存器是否被多个 always 块驱动？
4. 所有算术运算的位宽和有符号属性是否明确？
5. `case` 是否有 `default`？
6. 复位后所有控制寄存器是否进入合法状态？
7. testbench 中的延时和系统任务是否误写进可综合模块？
8. 生成的 RTL 是否和预期电路、波形一致？

这套规则覆盖了日常 RTL 中最常用的 Verilog 和 SystemVerilog 语法。下一步就是把每种语法放进 ALU、寄存器堆、FIFO 和五级流水线中练习，而不是继续背关键字。
