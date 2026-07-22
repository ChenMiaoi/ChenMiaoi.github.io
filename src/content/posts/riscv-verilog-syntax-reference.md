---
title: Verilog/SystemVerilog 语法详解：从词法到可综合 RTL
published: 2026-07-22T22:40:00+08:00
description: 系统梳理 Verilog 与 SystemVerilog 的字面量、位宽、四态值、赋值、过程块、数组、参数化、generate、接口、函数任务和断言语法。
image: ''
tags:
  - Verilog
  - SystemVerilog
  - RTL
  - RISC-V
category: hardware-language
series: riscv-verilog-syntax
seriesOrder: 3
lang: zh_CN
draft: false
---

前两章建立了 RTL 直觉。本章作为查阅型语法参考，把实际阅读 RISC-V RTL 时最容易踩坑的边角补齐。所有语法都要回到同一个问题：它最终是连线、组合网络、寄存器，还是只存在于仿真器中的行为？

## 1. 标识符、注释和编译指令

Verilog 标识符区分大小写，可以使用字母、数字、`_`，但不能以数字开头。SystemVerilog 还允许转义标识符：

```systemverilog
logic \signal.with.dot ;
```

转义名以反斜杠开始、空白结束，适合兼容奇怪的外部名称，但 RTL 中不应常用。注释有 `//` 和 `/* ... */` 两种；后者不能嵌套。

`` `define`、`` `include`、`` `ifdef` 等是预处理器指令，不是硬件语法。宏只是文本替换，因此参数、括号和副作用要格外小心：

```verilog
`define ADD(a, b) ((a) + (b))
`ifdef FORMAL
  `define ASSERT(x) assert(x)
`else
  `define ASSERT(x)
`endif
```

建议在可综合文件开头使用 `` `default_nettype none``，文件末尾恢复 `` `default_nettype wire``，避免拼写错误偷偷创建隐式网络。

## 2. 数字、位选择与四态值

数字字面量的形状是 `[宽度]'[进制][数字]`：`8'b1010_0001`、`32'h8000_0000`、`12'd4095`。下划线只用于可读性。无宽度数字通常是至少 32 位的整数，因上下文扩展可能造成意外，接口常量最好显式写宽度。

```systemverilog
logic [7:0]  a = 8'hff;
logic [15:0] b = 16'h00ff;
logic [31:0] z = 32'b0;
logic [31:0] all_ones = '1;
```

`'0`、`'1`、`'x`、`'z` 是按目标表达式宽度填充的未定宽字面量。仿真有 `0/1/x/z` 四态；`x` 常来自未复位寄存器，`z` 常表示高阻。`==`/`!=` 遇到未知位可能产生 `x`，`===`/`!==` 比较每一位并把 `x/z` 当作值，适合 testbench 和未知值检查。

## 3. packed、unpacked、切片和流操作

```systemverilog
logic [31:0] word;       // packed：一个 32 位向量
logic [7:0] bytes [0:3]; // unpacked：四个 8 位元素
```

packed 维度写在类型名左边，整体参与算术、比较和拼接；unpacked 维度写在右边，表示数组。`word[31:16]` 是 part-select，`word[base +: 8]` 是向上 indexed part-select，`word[base -: 8]` 是向下选择。

```systemverilog
assign upper = word[16 +: 8];
assign lower = word[31 -: 8];
assign wide  = {upper, lower};
assign repeat = {4{word[7:0]}};
```

streaming operator `{<<{data}}`、`{>>{data}}` 可以按 bit 或 byte 重排，但综合器支持度和读者理解成本不如显式切片。不要用它隐藏字节序决定。

## 4. 类型、转换与表达式优先级

`logic` 是变量类型，不能被多个过程同时驱动；`wire` 是网络类型，可由连续赋值或模块端口驱动。`bit` 是二态变量，`integer`/`int` 常用于循环或 testbench；RTL 总线应优先使用明确宽度的 `logic`。

```systemverilog
logic signed [15:0] offset;
logic        [15:0] raw;
assign target = $signed(offset) + $unsigned(raw);
```

`$signed` 和 `$unsigned` 只改变解释方式，不改变位数。算术右移 `>>>` 对 signed 操作数复制符号位，逻辑右移 `>>` 通常补零。比较前先统一宽度和符号，尤其是立即数、地址和数组索引混在一起时。

常见优先级陷阱是条件运算、移位和拼接混用。复杂表达式主动加括号，不要依赖记忆：`(a + b) << 2` 比 `a + b << 2` 清楚；拼接内部每个操作数都先独立求值。

## 5. 连续赋值、过程赋值和驱动规则

`assign` 描述网络的持续驱动：

```verilog
assign y = enable ? data : 32'b0;
```

`always_comb` 描述组合过程，应该给每个输出在所有路径赋值；`always_ff` 描述寄存器，变量原则上只能在一个块中赋值；`always_latch` 明确表示电平敏感锁存器。

阻塞赋值 `=` 立即更新当前过程中的变量，常用于组合逻辑；非阻塞赋值 `<=` 在当前时间步结束时更新，常用于时序逻辑。不要在同一个变量上混用两类过程，也不要把 testbench 的时序语义机械搬进综合 RTL。

```systemverilog
always_comb begin
  next = current; // 默认保持，避免意外 latch
  if (take) next = a;
end
always_ff @(posedge clk) begin
  if (reset) current <= IDLE;
  else       current <= next;
end
```

## 6. case、循环与函数

`if/else` 表达优先级选择；`case` 表达互斥枚举。`casez` 把 `z` 和 `?` 当作不关心位；`casex` 连 `x` 也忽略，容易把未初始化问题吞掉，综合 RTL 通常避免它。SystemVerilog 的 `unique`、`priority` 是意图声明，配合 `default` 使用更安全。

```systemverilog
always_comb begin
  y = '0;
  unique case (op)
    2'b00: y = a + b;
    2'b01: y = a - b;
    2'b10: y = a & b;
    default: y = a | b;
  endcase
end
```

`for` 在过程块中描述重复组合或时序操作；`genvar` 配合 `generate for` 在 elaboration 阶段复制硬件。函数不能包含时间控制，适合纯组合计算；task 可有多个输出，带 `#`、`@` 的 task 通常只放在验证环境中。用 `automatic` 为每次调用提供独立局部变量。

## 7. 数组、memory 与结构化类型

数组索引可以是动态信号，从而形成多路选择器或 RAM 推导。组合读和同步读有不同延迟：

```systemverilog
logic [31:0] mem [0:1023];
assign rdata = mem[raddr];
always_ff @(posedge clk) begin
  if (we) mem[waddr] <= wdata;
  sync_rdata <= mem[raddr];
end
```

`typedef enum logic [1:0]` 用于状态机，`typedef struct packed` 用于流水线包；packed struct 可以整体切片和连接。`union packed` 让同一组位拥有多种视图，不增加存储空间，使用时必须确保所有解释具有相同宽度。

## 8. 参数、localparam、generate 与接口

模块参数在 elaboration 时决定硬件结构：

```systemverilog
module fifo #(parameter int WIDTH = 32,
              parameter int DEPTH = 8,
              localparam int PTR_W = (DEPTH <= 1) ? 1 : $clog2(DEPTH)) (...);
```

`localparam` 不允许例化者覆盖。`parameter type T = logic [31:0]` 可以参数化类型。`generate if/for` 是编译期结构选择，不是运行时 mux；生成块命名后，波形层次会更稳定。

`interface` 把 valid、ready、data 聚合，`modport` 声明 source/sink 方向。`.*` 自动连接同名端口很短，却会把命名变化变成隐蔽 bug；公共模块优先使用显式 named connection。

## 9. 断言、属性和可综合边界

SVA 断言可以表达跨周期协议：

```systemverilog
assert property (@(posedge clk) disable iff (reset)
  valid && !ready |=> valid && $stable(data));
```

`cover property` 检查场景是否被激活。`(* ram_style = "block" *)` 一类属性只是工具提示，不能替代功能逻辑。`$display`、文件 IO、随机化和延时控制属于验证语境，不能让综合硬件依赖它们。

最后用一张表检查每个模块：每个输出是否全路径赋值；每个寄存器是否单一驱动；运算是否明确位宽和 signed；memory 的读延迟是否符合接口；参数是否只影响生成结构；断言是否覆盖复位、握手和状态转移。