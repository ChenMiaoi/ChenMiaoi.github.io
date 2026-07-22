---
title: Verilog 进阶语法：类型、参数化与可综合结构
published: 2026-07-22T22:20:00+08:00
description: 继续学习 Verilog 和 SystemVerilog 的类型、位宽、表达式、参数、generate、数组、接口组织与可综合 RTL 细节。
image: ''
tags:
  - Verilog
  - SystemVerilog
  - RTL
  - RISC-V
category: hardware-language
series: riscv-verilog-syntax
seriesOrder: 2
lang: zh_CN
draft: false
---

上一篇文章解决了“模块能不能写出来”的问题。这一篇继续处理更容易出错的地方：位宽、符号、赋值时机、参数化和模块边界。

这些语法看起来零散，但它们都会影响生成的电路。Verilog 不会把模糊的意图自动变成你想要的硬件。

## 1. 四态值和比较

Verilog 仿真使用四态值：`0`、`1`、`x` 和 `z`。综合后的普通逻辑通常只有 0 和 1，但仿真中的 `x` 很有用，它能暴露未复位或未驱动的信号。

```verilog
wire [3:0] a = 4'b10x1;
wire same_logical = (a == 4'b10x1);
wire same_bits = (a === 4'b10x1);
```

`==` 是逻辑相等，遇到未知位可能返回 `x`；`===` 是 case equality，把 `x` 和 `z` 也作为可比较的值。RTL 条件一般使用 `==`，testbench 检查未知值时常用 `===`。

`casex` 会把 `x` 视为不关心位，容易掩盖问题。验证代码之外不建议随意使用它。

## 2. 位宽传播

表达式的结果位宽并不总是等于你以为的宽度：

```verilog
reg [7:0] a, b;
reg [7:0] y;

assign y = a + b;
```

两个 8 位数相加，结果可能需要 9 位保存进位。若需要保留进位，先扩展操作数：

```verilog
wire [8:0] sum = {1'b0, a} + {1'b0, b};
```

截断也应该写得明确：

```verilog
wire [7:0] low = sum[7:0];
wire carry = sum[8];
```

## 3. 有符号数

默认情况下，`reg [31:0]` 和 `wire [31:0]` 是无符号向量。需要有符号运算时使用 `signed`：

```verilog
reg signed [31:0] a;
reg signed [31:0] b;
wire signed [31:0] result = a + b;
```

SystemVerilog 可以用 `$signed` 和 `$unsigned` 显式转换：

```systemverilog
assign y = $signed(a) >>> shift_amount;
assign z = $unsigned(a) >> shift_amount;
```

算术右移 `>>>` 会复制符号位，逻辑右移 `>>` 会补零。地址、寄存器编号通常是无符号；立即数、比较操作和算术结果要根据 ISA 语义决定是否有符号。

## 4. 拼接、复制和流操作

普通拼接：

```verilog
assign instruction = {opcode, rd, funct3, rs1, rs2};
```

复制拼接：

```verilog
assign sign_extended = {{20{imm[11]}}, imm};
```

SystemVerilog 还支持 streaming operator：

```systemverilog
assign reversed = {<<{data}};
```

它可以按位或按字节重新排列数据。使用前要确认工具版本和目标综合器是否支持；对普通 RTL 来说，显式切片往往更容易读和调试。

## 5. implicit net 和 default_nettype

拼写错误可能创建一个隐式 wire：

```verilog
assign reslt = a + b; // reslt 可能被当成隐式网络
```

大型项目通常在文件开头关闭它：

```verilog
`default_nettype none

module alu (...);
endmodule

`default_nettype wire
```

关闭后，拼写错误会直接报错。文件结束时恢复默认值，避免影响被 include 的其他文件。

## 6. 参数、localparam 和类型参数

参数可以配置位宽、深度和结构：

```verilog
module fifo #(
    parameter int WIDTH = 32,
    parameter int DEPTH = 8,
    localparam int PTR_WIDTH = $clog2(DEPTH)
) (
    input logic clk,
    input logic [WIDTH-1:0] wdata
);
endmodule
```

`localparam` 不能由例化者覆盖。`$clog2` 返回能表示给定数量所需的位数，但深度不是 2 的幂时，空满判断仍需要额外考虑。

SystemVerilog 还支持 parameter type：

```systemverilog
module register_box #(parameter type T = logic [31:0]) (
    input logic clk,
    input T d,
    output T q
);
    always_ff @(posedge clk) q <= d;
endmodule
```

## 7. generate 和 elaboration

`generate` 在仿真运行之前展开。它适合根据参数生成重复结构：

```verilog
genvar i;
generate
    for (i = 0; i < LANES; i = i + 1) begin : lanes
        lane_unit u_lane (.in(data[i]), .out(result[i]));
    end
endgenerate
```

生成块有名字，层次路径会包含 `lanes[0]`、`lanes[1]`。给生成块命名有利于波形和约束定位。

```systemverilog
generate
    if (HAS_MUL) begin : gen_mul
        multiplier u_mul (...);
    end else begin : gen_no_mul
        assign mul_result = '0;
    end
endgenerate
```

这和运行时 `if` 不同。参数决定电路结构，输入信号决定电路运行时的选择。

## 8. always_comb 和 always_ff 的边界

SystemVerilog 的专用 always 块会帮助工具检查意图：

```systemverilog
always_comb begin
    next_state = state;
    case (state)
        IDLE: if (start) next_state = RUN;
        RUN:  if (done)  next_state = IDLE;
        default: next_state = IDLE;
    endcase
end

always_ff @(posedge clk) begin
    if (reset) state <= IDLE;
    else       state <= next_state;
end
```

组合块不能写寄存器，时序块不能被多个进程驱动。不要在同一个变量上同时使用 `assign` 和 `always_comb`。

## 9. always_latch 和 latch

如果设计确实需要 latch，可以明确写出：

```systemverilog
always_latch begin
    if (enable)
        q <= d;
end
```

但 CPU 数据通路里大多数状态都应该是边沿触发寄存器。组合块漏赋值而意外生成 latch，是更常见也更危险的情况。

## 10. struct、union 和 typedef

`typedef` 可以让端口更容易读：

```systemverilog
typedef struct packed {
    logic [31:0] pc;
    logic [31:0] inst;
    logic        valid;
} fetch_packet_t;

fetch_packet_t packet;
```

`packed struct` 可以整体切片、比较和连接。`unpacked struct` 更像仿真数据结构，不一定适合直接作为 RTL 总线。

`union packed` 让同一组位有多种解释，但它不会增加存储空间：

```systemverilog
typedef union packed {
    logic [31:0] raw;
    logic [6:0] opcode;
} instruction_view_t;
```

## 11. interface 和 modport

SystemVerilog interface 可以把握手信号集中起来：

```systemverilog
interface stream_if #(parameter WIDTH = 32) (input logic clk);
    logic valid;
    logic ready;
    logic [WIDTH-1:0] data;

    modport source(output valid, output data, input ready);
    modport sink(input valid, input data, output ready);
endinterface
```

模块使用 modport 表达角色：

```systemverilog
module producer(stream_if.source out);
    assign out.valid = 1'b1;
    assign out.data = 32'd42;
endmodule
```

interface 减少端口列表，但也增加了层次和方向的隐含信息。团队需要统一 interface 的命名和 modport 约定。

## 12. 函数、任务和 automatic

函数通常描述组合计算：

```systemverilog
function automatic logic [31:0] sext12(input logic [11:0] imm);
    return {{20{imm[11]}}, imm};
endfunction
```

`automatic` 让每次调用拥有独立的局部存储，递归或并行调用时更安全。task 可以有多个输出：

```systemverilog
task automatic check(input logic [31:0] expected, input logic [31:0] actual);
    assert (expected == actual)
        else $error("mismatch");
endtask
```

带时序控制的 task 通常只用于 testbench。

## 13. 端口连接和 named block

命名连接比位置连接更安全：

```verilog
alu u_alu (
    .a       (rs1_value),
    .b       (rs2_value),
    .opcode  (alu_opcode),
    .result  (alu_result)
);
```

SystemVerilog 的 `.*` 会自动连接同名信号：

```systemverilog
alu u_alu (.*);
```

它很短，但端口名变化时可能产生意外连接。公共模块和关键路径建议使用显式连接。

## 14. memory、RAM 和读写时序

组合读：

```verilog
assign rdata = mem[raddr];
```

同步读：

```systemverilog
always_ff @(posedge clk) begin
    if (we) mem[waddr] <= wdata;
    rdata <= mem[raddr];
end
```

两种写法可能推导出不同的 RAM 资源和读延迟。不要只看语法，必须确认目标 FPGA/ASIC 工具对该模板的推导结果。

## 15. 约束、属性和综合提示

SystemVerilog 属性可以附在对象上：

```systemverilog
(* ram_style = "block" *) logic [31:0] mem [0:1023];
```

这类属性通常是工具提示，不是语言语义。换工具后可能被忽略。把真正的功能行为写在 RTL 中，不要依赖属性保证正确性。

## 16. 断言和覆盖率

时序断言可以检查 ready/valid：

```systemverilog
assert property (@(posedge clk) disable iff (reset)
    valid && !ready |=> valid
);
```

当发送方 valid 且接收方未 ready 时，下一周期仍应保持 valid。覆盖率则回答测试是否真正走过某个状态：

```systemverilog
cover property (@(posedge clk) state == RUN && flush);
```

## 17. Verilog 进阶检查表

- 所有运算的宽度是否明确？
- signed 和 unsigned 是否混用？
- 组合逻辑是否覆盖所有路径？
- 每个寄存器是否只有一个驱动进程？
- 参数和 generate 是否只决定生成结构？
- RAM 读写时序是否符合目标资源？
- interface 的 modport 方向是否正确？
- 仿真专用语句是否与可综合 RTL 分开？
- 是否打开了 `default_nettype none`？
- 断言是否覆盖握手、复位和状态转移？

掌握这些内容后，Verilog 语法就不只是 `always` 和 `assign`。下一步应该把类型、参数、接口和断言放进真实的寄存器堆、FIFO 和流水线模块里反复验证。
