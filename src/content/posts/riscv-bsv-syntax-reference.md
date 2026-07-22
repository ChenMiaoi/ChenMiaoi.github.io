---
title: BSV 语法详解：类型类、方法守卫与规则调度
published: 2026-07-22T22:44:00+08:00
description: 详细解释 Bluespec SystemVerilog 的 package、interface、method、ActionValue、rule、guard、类型类、tagged union、Vector 与调度语法。
image: ''
tags:
  - BSV
  - Bluespec
  - RTL
  - RISC-V
category: hardware-language
series: riscv-bsv-syntax
seriesOrder: 3
lang: zh_CN
draft: false
---

BSV 最需要建立的语法直觉是：方法调用不仅可能读值，还可能产生状态更新；规则不仅有显式条件，还会吸收所调用方法的 guard；多条规则能否同周期执行取决于读写冲突和调度信息。本章把这些容易被一眼略过的部分展开。

## 1. package、import、typedef 与命名

BSV 文件通常放在 package 中：

```bsv
package Alu;
import Vector::*;

typedef Bit#(32) Word;
interface AluIfc;
  method Word execute(Word a, Word b, Bit#(2) op);
endinterface
endpackage
```

使用时 `import Alu::*;`。`typedef` 只建立类型别名；`struct`、`enum` 和 `union tagged` 则定义新结构。大型工程应区分公开 package 和内部 helper，避免所有实现细节变成公共名称。

## 2. Bit、UInt、Int 与 sized literal

`Bit#(n)` 表示 n 位位向量，不自动带符号；`UInt#(n)` 和 `Int#(n)` 表达无符号、有符号整数。字段切片写作 `x[hi:lo]`，拼接写作 `{a,b}`：

```bsv
Bit#(32) inst = 32'h00000013;
Bit#(5) rd = inst[11:7];
Bit#(32) shifted = inst << 2;
```

BSV 的宽度是类型的一部分。算术结果、扩展和截断应显式处理，不能假设普通整数常量会自动得到正确宽度。`signExtend`、`zeroExtend` 等库函数比手写拼接更能表达意图，但仍需确认目标类型。

## 3. interface、method、Action 和 ActionValue

```bsv
interface Counter;
  method Action inc();
  method UInt#(8) value();
  method ActionValue#(UInt#(8)) pop();
endinterface
```

普通 method 返回值；`Action` 只改变状态；`ActionValue#(t)` 同时改变状态并返回 `t`。实现中寄存器更新使用 `<=`，不是立即修改的 Scala/C 变量赋值：

```bsv
module mkCounter(Counter);
  Reg#(UInt#(8)) count <- mkReg(0);
  method Action inc(); count <= count + 1; endmethod
  method UInt#(8) value(); return count; endmethod
endmodule
```

调用 ActionValue 使用 `<-`，只读取值则使用 `let` 或普通表达式：

```bsv
let x <- fifo.pop;
fifo.enq(x + 1);
```

`<-` 是“执行动作并绑定返回值”的重要视觉提示。

## 4. method guard 与隐含条件

方法可以用 guard 限定可调用状态：

```bsv
method Action deq() if (!empty);
  head <= head + 1;
endmethod
```

guard 不只是运行时 `if`，它会成为方法的可用条件，并传播到调用它的 rule：

```bsv
rule move;
  let x <- source.get;
  sink.put(x);
endrule
```

此 rule 的隐含条件包含 `source.get` 和 `sink.put` 的 guard。因而规则只有在两边都可用时才有资格执行，不必手工复制所有 ready 信号。注意普通 method 也可能读取状态；调用关系会影响调度分析。

## 5. rule、条件与原子更新

```bsv
rule tick (enabled && count < 10);
  count <= count + 1;
  valid <= True;
endrule
```

rule 的多条寄存器更新属于一个 guarded atomic action：同一规则执行时一起生效。无括号条件的 rule 表示只要其隐含方法条件满足就可执行。rule 中的 `let` 绑定临时值，`if` 可做局部条件，但不能把规则原子性理解为无限并发。

如果两个规则写同一个寄存器，或者一个读、一个写同一状态，编译器需要判断冲突。条件互斥、显式优先级和 schedule 声明都可能改变合法并发组合。设计者仍需决定哪个请求获胜，BSV 不会自动推断业务优先级。

## 6. case、matches、tagged union 与 Maybe

```bsv
typedef union tagged {
  void Invalid;
  Bit#(32) Valid;
} MaybeWord deriving (Bits, FShow);

function Bit#(32) unwrap(MaybeWord x);
  case (x) matches
    tagged Invalid: return 0;
    tagged Valid .v: return v;
  endcase
endfunction
```

`union tagged` 在数据外携带标签，适合表达互斥状态；`case (...) matches` 进行模式匹配，绑定字段时使用点号变量。`deriving (Bits, FShow, Eq)` 请求编译器为类型生成位编码、打印和比较能力。标签不是注释，它会占据编码并约束匹配完整性。

普通 `case` 适合枚举和位字段；组合逻辑函数应覆盖所有分支，避免未定义返回值。

## 7. struct、enum 和 record 更新

```bsv
typedef struct {
  Bit#(32) pc;
  Bit#(32) inst;
  Bool valid;
} Fetch deriving (Bits, FShow);
```

字段用 `x.pc` 访问。结构值可以用 record 语法构造和更新，`deriving` 让它能进寄存器、FIFO 或接口。`typedef enum { Idle, Run, Done } State deriving (Bits, Eq);` 适合状态机；状态编码仍应通过生成 RTL 和工具报告确认。

## 8. provisos 与类型类

类型参数只说明“某个未知类型”，`provisos` 说明它具有什么能力：

```bsv
interface Source#(type t);
  method ActionValue#(t) get();
endinterface

module mkBox#(type t)(Source#(t))
  provisos(Bits#(t, n), Eq#(t));
  Reg#(t) r <- mkRegU;
  method ActionValue#(t) get();
    actionvalue return r; endactionvalue
  endmethod
endmodule
```

常见类型类有 `Bits`、`Eq`、`FShow`、`Ord`、`Literal`、`Arith`。多个约束用逗号分隔；`Bits#(t,n)` 中的 `n` 也是由类型推导或约束确定的位宽。错误信息很长时，先逐个检查每个运算符需要的类型能力。

可以定义自己的 typeclass 和 instance：

```bsv
typeclass Encodable#(type t);
  function Bit#(32) encode(t x);
endtypeclass
```

只为真实复用建立抽象，过度类型类会把简单数据流藏在 provisos 后面。

## 9. Vector、List、map 与生成期计算

`Vector#(n,t)` 是固定长度集合，适合生成并行硬件：

```bsv
Vector#(4, Reg#(Bit#(32))) lanes <- replicateM(mkReg(0));
Vector#(4, Bit#(32)) sums = zipWith(add32, xs, ys);
```

`replicateM` 构造多个模块或寄存器，`map`/`zipWith`/`fold` 组织固定结构。`List` 更偏编译期集合；可综合设计必须让长度和存储最终确定，不能把软件动态链表当作免费硬件。

`Integer`、`natural` 等参数参与 elaboration；`Bit#(n)` 才是硬件数据。用函数计算字节数、指针宽度时，要确保结果进入类型参数而不是误当运行时信号。

## 10. FIFO、接口组合和流水线

```bsv
interface Pipe#(type t);
  method Action enq(t x);
  method ActionValue#(t) deq();
endinterface

module mkPipe(Pipe#(t)) provisos(Bits#(t,n));
  FIFO#(t) q <- mkFIFO;
  method Action enq(t x) if (!q.full); q.enq(x); endmethod
  method ActionValue#(t) deq() if (!q.empty);
    actionvalue let x = q.first; q.deq; return x; endactionvalue
  endmethod
endmodule
```

队列的 empty/full guard 会传播到规则。入队和出队能否同周期发生取决于 FIFO 实现的 method schedule，不应只凭接口名称猜测。嵌套 interface 可直接暴露子模块端口，让顶层保持薄：

```bsv
interface Cpu;
  interface Pipe#(Word) memory;
  method Action start(Word pc);
endinterface
```

## 11. 时钟、复位和 schedule

模块默认带隐含时钟和复位；需要显式域时可在 interface 中传递 `Clock`、`Reset`，或使用带时钟参数的原语。跨域仍需同步器/异步 FIFO，规则调度解决不了物理亚稳态。

Schedule 声明表达 method 的并发关系：可以同周期、必须先后、或互斥。具体 pragma/语法依工具和库版本而异，但设计审查必须回答：同周期允许哪些 enqueue/dequeue、读写和提交组合？吞吐率是否真的能达到预期？

## 12. 仿真边界与检查清单

`$display`、文件读写、延时和 testbench helper 属于仿真环境；它们不能成为硬件功能依赖。最终检查：每个类型参数所需的 provisos 是否完整；每个 tagged 分支是否处理；ActionValue 是否使用 `<-`；method guard 是否表达空满和资源条件；rule 冲突是否有明确优先级；FIFO 的同时入出队和 reset 首拍是否验证；生成的 Verilog 是否包含预期寄存器、组合路径和调度逻辑。