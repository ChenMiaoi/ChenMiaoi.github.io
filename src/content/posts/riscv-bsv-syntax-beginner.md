---
title: BSV 语法入门：用规则描述硬件行为
published: 2026-07-22T22:08:55+08:00
description: 从零开始学习 Bluespec SystemVerilog，理解 interface、method、rule、寄存器和规则调度，并用计数器和 FIFO 认识 BSV 的基本写法。
image: ''
tags:
  - RISC-V
  - BSV
  - Bluespec
  - RTL
  - 硬件设计
category: hardware-language
series: riscv-bsv-syntax
seriesOrder: 1
lang: zh_CN
draft: false
---

BSV（Bluespec SystemVerilog）和 Verilog 都能描述 RTL，但写代码时关注的事情不一样。

Verilog 常常从“这个时钟沿要把哪些寄存器更新成什么”开始。BSV 更常从“在什么条件下，一组操作可以一起发生”开始。这个条件下可以执行的动作叫 `rule`，对外提供的操作通常写成 `method`。

这不是说 BSV 没有时钟，也不是说工具会替你猜出所有电路。BSV 代码最后仍然会变成时序逻辑、组合逻辑和握手信号。只是你先写清楚行为和条件，再让编译器处理一部分调度细节。

```text
寄存器状态 ──> rule 的条件判断 ──> 一组原子更新
                   │
                   └────────────> 生成 RTL 和调度逻辑
```

本文以几个小模块介绍 BSV 的基本语法。代码使用 Bluespec SystemVerilog 的写法，具体工具命令会因项目而异。

## 1. 第一个模块

BSV 模块通常有一个接口类型和一个实现模块：

```text
interface AndGate;
    method Bit#(1) result(Bit#(1) a, Bit#(1) b);
endinterface

module mkAndGate(AndGate);
    method Bit#(1) result(Bit#(1) a, Bit#(1) b);
        return a & b;
    endmethod
endmodule
```

`interface AndGate` 声明模块对外提供什么。这里提供一个名为 `result` 的方法，接受两个 1 位输入并返回 1 位结果。

`module mkAndGate(AndGate)` 实现这个接口。BSV 的模块名通常以 `mk` 开头，这只是常见约定，不是语法强制要求。

## 2. Bit、UInt 和 Int

BSV 的位向量写作 `Bit#(n)`，其中 `n` 是位数：

```text
Bit#(8)  a;
Bit#(32) address;
```

有符号和无符号整数分别可以使用 `Int#(n)` 与 `UInt#(n)`：

```text
UInt#(8) count;
Int#(16) offset;
```

对于寄存器、总线和指令字段，`Bit#(n)` 很常见。它只表示 n 位数据，不自动表达有符号含义。

```text
Bit#(8) x = 8'h2a;
Bit#(4) high = x[7:4];
Bit#(4) low  = x[3:0];
```

常见的位操作包括：

```text
Bit#(8) y = a << 1;
Bit#(8) z = a & 8'h0f;
Bit#(16) wide = {a, a};
```

花括号表示拼接。位宽最好写清楚，尤其是把小位宽信号送进 32 位 RISC-V 数据通路时。

## 3. method 是模块的接口

method 可以有参数，也可以没有参数。没有参数的方法通常用来读取状态：

```text
interface Counter;
    method Action increment();
    method UInt#(8) value();
endinterface
```

`Action` 表示这个方法会产生动作，但不返回数据。`value()` 返回当前计数值。

实现时可以使用寄存器：

```text
module mkCounter(Counter);
    Reg#(UInt#(8)) count <- mkReg(0);

    method Action increment();
        count <= count + 1;
    endmethod

    method UInt#(8) value();
        return count;
    endmethod
endmodule
```

`Reg#(UInt#(8))` 是一个 8 位寄存器。`<- mkReg(0)` 创建并初始化它。

这里的 `count <= count + 1` 看起来像赋值，但它表达的是寄存器的下一状态更新。实际什么时候调用 `increment`，由规则或更上层模块决定。

## 4. rule：带条件的原子动作

`rule` 包含一个名字、一个可选条件和一组动作：

```text
rule tick;
    count <= count + 1;
endrule
```

这条规则没有显式条件，只要它存在，就表示每个时钟周期都可以执行。更常见的写法是加条件：

```text
Reg#(UInt#(8)) count <- mkReg(0);
Reg#(Bool) enabled <- mkReg(False);

rule tick (enabled);
    count <= count + 1;
endrule
```

当 `enabled` 为 `True` 时，`tick` 才有资格执行。规则中的多条寄存器更新属于同一组原子动作：要么一起发生，要么都不发生。

```text
enabled = False       enabled = True
     │                      │
     └─ tick 不执行        └─ count 在时钟沿加一
```

BSV 编译器会根据规则读取和写入的状态判断哪些规则可以同时调度。如果两个规则都写同一个寄存器，工具需要知道它们是否可以并发，或者需要安排先后顺序。

## 5. 规则之间的冲突

看两个简单规则：

```text
rule add_one (count < 10);
    count <= count + 1;
endrule

rule clear (count == 10);
    count <= 0;
endrule
```

这两个规则的条件互斥，所以不会在同一个状态下同时执行。另一种情况是：

```text
rule write_a (do_a);
    value <= a;
endrule

rule write_b (do_b);
    value <= b;
endrule
```

如果 `do_a` 和 `do_b` 同时为真，两个规则都会尝试写 `value`。这时必须明确设计意图：让条件互斥、给规则加优先级，或者使用更合适的接口和调度声明。

BSV 不会让冲突自动变成正确的业务逻辑。它能检查并报告很多冲突，但“哪个请求应该获胜”仍然是设计者的决定。

## 6. interface 组合模块

一个模块可以把另一个模块作为内部组件：

```text
interface Adder;
    method UInt#(32) add(UInt#(32) a, UInt#(32) b);
endinterface

module mkAdder(Adder);
    method UInt#(32) add(UInt#(32) a, UInt#(32) b);
        return a + b;
    endmethod
endmodule
```

更大的模块通常会把多个接口组合起来：

```text
interface SimpleAlu;
    method UInt#(32) execute(UInt#(32) a, UInt#(32) b, Bit#(2) op);
endinterface

module mkSimpleAlu(SimpleAlu);
    method UInt#(32) execute(UInt#(32) a, UInt#(32) b, Bit#(2) op);
        case (op)
            2'b00: return a + b;
            2'b01: return a - b;
            2'b10: return a & b;
            default: return a | b;
        endcase
    endmethod
endmodule
```

`case` 的语法和 SystemVerilog 接近。ALU 仍然是组合逻辑，因为 `execute` 没有读写寄存器，也没有等待时钟。

## 7. FIFO：BSV 最常见的练习

FIFO 很适合学习 BSV，因为它有入队、出队、读队头和满/空条件。

```text
interface SimpleFifo#(type t);
    method Action enq(t x);
    method Action deq();
    method t first();
    method Bool notEmpty();
endinterface
```

`#(type t)` 是类型参数。调用者可以把同一个 FIFO 结构用于 `UInt#(32)` 或其他数据类型。

如果使用库里的 FIFO，代码可以很短：

```text
module mkSimpleFifo(SimpleFifo#(t))
        provisos(Bits#(t, tSize));
    FIFO#(t) fifo <- mkFIFO;

    method Action enq(t x) if (!fifo.full);
        fifo.enq(x);
    endmethod

    method Action deq() if (!fifo.empty);
        fifo.deq;
    endmethod

    method t first() if (!fifo.empty);
        return fifo.first;
    endmethod

    method Bool notEmpty();
        return !fifo.empty;
    endmethod
endmodule
```

这里的 `if (!fifo.empty)` 是 method 的 guard。队列为空时，`deq` 和 `first` 不可用。这个条件会参与调用方的规则调度。

一个消费 FIFO 的规则可以这样写：

```text
rule consume (fifo.notEmpty);
    let instruction = fifo.first;
    fifo.deq;
    process(instruction);
endrule
```

`let` 可以绑定一个临时值。规则只在 FIFO 非空时执行，同时完成读取和出队。

## 8. 规则如何连接流水线

RISC-V 流水线可以先用三个规则表示：

```text
fetch ──> decode ──> execute
  │          │           │
 fetchQ    decodeQ    executeQ
```

对应的行为可以写成：

```text
rule fetchToDecode (fetchQ.notEmpty && decodeQ.notFull);
    let inst = fetchQ.first;
    fetchQ.deq;
    decodeQ.enq(decode(inst));
endrule

rule decodeToExecute (decodeQ.notEmpty && executeQ.notFull);
    let inst = decodeQ.first;
    decodeQ.deq;
    executeQ.enq(execute(inst));
endrule
```

两条规则操作不同的队列时，编译器有机会安排它们在同一个时钟周期并发执行。若它们访问相同状态，调度器会根据条件和接口约束检查冲突。

这和 Verilog 中手工写流水线寄存器的方式不同。Verilog 直接写每个时钟沿的赋值；BSV 先表达“哪一级现在可以把什么东西交给下一级”。两种写法最后都要验证生成的 RTL 是否符合预期。

## 9. Action、ActionValue 和 return

BSV 里常见三种 method 形式：

```text
method Action clear();
    state <= 0;
endmethod

method UInt#(32) read();
    return state;
endmethod

method ActionValue#(UInt#(32)) pop();
    let x = fifo.first;
    fifo.deq;
    return x;
endmethod
```

- `Action` 只产生动作；
- 普通返回类型只读数据；
- `ActionValue#(t)` 同时修改状态并返回一个 `t`。

调用 `ActionValue` method 时常用 `let` 接收返回值：

```text
rule readAndConsume;
    let value <- fifo.pop;
    use(value);
endrule
```

`<-` 表示这里有一个动作，不能把它当成普通函数调用的 `=`。

## 10. BSV 和时钟到底是什么关系

BSV 不是软件线程系统。规则仍然在离散时钟周期上执行，寄存器仍然在时钟边沿更新。

BSV 代码中不一定到处写 `posedge clk`，因为模块和寄存器的时序结构由语言和工具管理。对于学习者来说，应该始终保留这张图：

```text
当前状态
    │
    ├── 规则条件满足？ ── 否 ──> 保持状态
    │
   是
    │
    └── 在一个时钟周期内提交规则中的更新
```

如果一条规则读取了一个寄存器，又在同一条规则里写它，读取到的是当前状态，写入的是下一个状态。这和同步 RTL 中的非阻塞寄存器更新相近。

## 11. 初学 BSV 时的检查清单

写完一个 module 后，可以按下面几项检查：

- interface 是否只暴露真正需要给外部使用的方法？
- 每个 method 的 guard 是否完整？
- 每条 rule 会读取和写入哪些寄存器或 FIFO？
- 两条可能同时启用的规则是否会写同一状态？
- `Action` 和 `ActionValue` 是否选对？
- 类型参数和位宽是否清楚？
- 生成的 RTL 是否需要额外的 ready/enable 信号？

BSV 的难点不是记住 `rule` 和 `method` 的拼写，而是学会把并发行为拆成一组有条件的原子操作。等你用规则写完一个 FIFO，再回头看流水线，许多“什么时候允许推进”的控制逻辑会变得更直观。

下一篇会用 Chisel 做同样的事情。Chisel 不把规则作为核心抽象，而是用 Scala 程序构造硬件结构。三篇文章放在一起看，更容易分清三种语言真正不同的地方。

## 12. BSV 的词法、表达式和类型

BSV 区分大小写。注释可以写成 `//` 或 `/* ... */`。常量可以使用不同进制：

```text
8'b1010_0001
8'hA1
32'd100
```

常见基础类型包括 `Bool`、`Bit#(n)`、`UInt#(n)`、`Int#(n)` 和 `Integer`。`Integer` 主要用于编译期计算，不能直接当作固定宽度的硬件总线。

```text
Bool valid = True;
Bit#(8) byte = 8'hff;
UInt#(32) address = 0;
```

类型参数使用 `#(...)`。这让同一个模块可以接受不同宽度或不同数据类型。

## 13. 类型转换、位选择和拼接

BSV 不会替你忽略所有类型和位宽差异。常见转换包括：

```text
Bit#(8)  x = 8'h2a;
UInt#(8) y = unpack(x);
Bit#(8)  z = pack(y);
```

位选择和拼接：

```text
Bit#(4) high = x[7:4];
Bit#(4) low = x[3:0];
Bit#(16) wide = {x, x};
```

`truncate` 可以截断位宽，`zeroExtend` 和 `signExtend` 可以扩展位宽。扩展前要先确认数据是否有符号。

```text
Bit#(32) address = zeroExtend(offset);
```

## 14. typedef、struct、union 和 enum

`typedef` 可以给复杂类型起一个稳定的名字：

```text
typedef struct {
    Bit#(32) pc;
    Bit#(32) instruction;
    Bool valid;
} FetchPacket deriving (Bits, FShow);
```

`struct` 适合表示流水线数据包。`union tagged` 适合表示几种互斥的结果：

```text
typedef union tagged {
    void NoResult;
    Bit#(32) Value;
} ExecuteResult deriving (Bits, FShow);
```

枚举可以用 `typedef enum`：

```text
typedef enum {Idle, Running, Done} State deriving (Bits, Eq, FShow);
```

`deriving` 让工具为类型自动生成位编码、比较和打印实例。

## 15. 函数和高阶函数

纯组合计算可以写成 function：

```text
function Bit#(32) add32(Bit#(32) a, Bit#(32) b);
    return a + b;
endfunction
```

函数没有寄存器更新，也不能直接执行一个需要时钟的动作。参数化函数可以写成：

```text
function Bit#(n) addN(Bit#(n) a, Bit#(n) b);
    return a + b;
endfunction
```

当函数需要某个类型实例时，可以在模块或函数后写 `provisos`：

```text
function t choose(Bool sel, t a, t b)
    provisos(Bits#(t, width));
    return sel ? a : b;
endfunction
```

## 16. Vector、List 和数组

`Vector#(n, t)` 表示固定长度的硬件向量：

```text
Vector#(4, UInt#(32)) lanes <- replicateM(0);
lanes[0] = 1;
```

`List` 更适合编译期构造和遍历。硬件中的数组通常用 `Vector`、寄存器组或存储器原语表示。不要把任意 Scala 风格的动态 List 当成运行时硬件内存。

常用操作包括 `replicateM`、`map`、`zipWith` 和 `fold`。这些操作在 elaboration 或组合结构构造中很有用。

## 17. method guard 和 interface 组合

method 的 guard 是接口协议的一部分：

```text
method Action enq(t x) if (!full);
    data <= x;
endmethod
```

调用方只有在 guard 成立时才能调用它。接口也可以嵌套：

```text
interface Cpu;
    interface MemoryClient memory;
    method Action start(Bit#(32) pc);
endinterface
```

这样可以把内存请求接口和 CPU 控制接口分开。`interface` 组合得好，模块之间的连接会比一长串散开的端口更容易检查。

## 18. rule 的执行、条件和优先级

规则由隐含条件决定。规则读取的 method guard、显式条件和内部状态共同决定它是否可执行：

```text
rule issue (queue.notEmpty && fu.canAccept);
    let inst = queue.first;
    queue.deq;
    fu.accept(inst);
endrule
```

如果多个规则可以执行，调度器会根据规则之间的读写关系、method 约束和静态优先级生成调度逻辑。需要优先级时，应在设计中明确表达，而不是依赖代码出现顺序。

当两个规则可能互斥或冲突时，先看它们读取和写入的状态，再决定是否拆分规则、加 guard 或使用调度属性。

## 19. action block 和顺序动作

多个动作可以放进 `action ... endaction`：

```text
method Action resetAll();
    action
        count <= 0;
        valid <= False;
    endaction
endmethod
```

`actionvalue ... endactionvalue` 可以在更新状态的同时返回数据：

```text
method ActionValue#(t) pop() if (!empty);
    actionvalue
        let x = fifo.first;
        fifo.deq;
        return x;
    endactionvalue
endmethod
```

## 20. 参数化模块和 provisos

模块可以使用类型和数值参数：

```text
module mkDelay#(Integer depth, type t)(Delay#(t))
    provisos(Bits#(t, width));
    Vector#(depth, Reg#(t)) pipe <- replicateM(mkRegU);
endmodule
```

`Integer depth` 在生成硬件时决定结构大小，`type t` 决定数据类型，`provisos` 声明工具需要的类型能力。参数化模块是复用 BSV 代码的主要方式。

## 21. 时钟、复位和跨时钟域

大多数模块使用隐含的默认时钟和复位。也可以显式声明 `Clock` 和 `Reset`，在不同接口中使用不同的时钟域。

跨时钟域不能只把一个 `Bit` 接到另一个时钟上。应使用同步器、异步 FIFO 或平台提供的 CDC 结构。BSV 的规则调度不会自动解决物理上的亚稳态问题。

## 22. 仿真、打印和断言

BSV 仿真中可以使用 `display`、`fshow` 和 `$display` 风格的打印：

```text
rule debug;
    $display("pc = %h", pc);
endrule
```

打印、文件操作和仿真专用 helper 不应进入需要综合的设计路径。验证 FIFO 和流水线时，同时检查规则是否在正确周期启用、数据是否丢失和 backpressure 是否传播。

## 23. BSV 项目的检查表

- 所有接口 method 的 guard 是否说明了可用条件？
- 每条 rule 的读写集合是否清楚？
- 可能同时写相同寄存器的规则是否有明确处理？
- `Action`、`ActionValue` 和普通返回值是否使用正确？
- `Bit`、`UInt`、`Int` 的符号和位宽是否正确？
- 参数化模块的 `provisos` 是否完整？
- FIFO 空满、valid/ready 和复位条件是否覆盖？
- 生成的 Verilog 和规则调度是否经过仿真检查？

掌握这些语法后，可以从一个两级 FIFO 开始，再实现取指和执行之间的队列。BSV 的价值不在于少写几行代码，而在于把并发操作和它们的可用条件写得清楚。
