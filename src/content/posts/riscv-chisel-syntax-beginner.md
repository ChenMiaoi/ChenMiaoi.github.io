---
title: Chisel 语法入门：用 Scala 构造硬件
published: 2026-07-22T22:06:12+08:00
description: 从零开始学习 Chisel，理解 Module、UInt、连接符、寄存器、Bundle、Vec 和 Decoupled 接口，并用 Scala 的抽象能力构造简单 RTL。
image: ''
tags:
  - RISC-V
  - Chisel
  - Scala
  - RTL
  - 硬件设计
category: hardware-language
series: riscv-chisel-syntax
seriesOrder: 1
lang: zh_CN
draft: false
---

Chisel 不是“把 Verilog 关键字翻译成 Scala”。它是一套用 Scala 程序构造硬件的工具和语言库。

你写的是 Scala 代码，但 `UInt`、`Bool`、`Reg`、`Module` 这些对象描述的是硬件。运行 Chisel 程序时，工具会建立硬件结构，再生成 Verilog 或其他 RTL 表示。

可以先把整个过程看成三步：

```text
Scala + Chisel 代码
        │
        ▼
硬件构造图（Module、连线、寄存器）
        │
        ▼
生成 Verilog / RTL
```

这带来一个很实用的能力：你可以用函数、类、参数和集合来复用硬件结构。不过，最后生成的仍然是硬件，不是运行在 CPU 上的普通 Scala 程序。

## 1. 第一个 Module

Chisel 模块通常继承 `Module`，并定义一个 `io` 接口：

```scala
import chisel3._

class AndGate extends Module {
  val io = IO(new Bundle {
    val a = Input(Bool())
    val b = Input(Bool())
    val y = Output(Bool())
  })

  io.y := io.a & io.b
}
```

`Module` 是硬件模块。`IO` 声明模块的边界。`Input` 和 `Output` 区分方向。`:=` 是 Chisel 的连接符，表示把右侧信号连接到左侧。

这里没有 Scala 的 `if`，也没有 `return`。`io.y := io.a & io.b` 构造的是一段组合逻辑。

## 2. Bool、UInt 和位宽

Chisel 里最常见的基础类型包括：

```scala
val flag = Wire(Bool())
val value = Wire(UInt(8.W))
val signed = Wire(SInt(16.W))
```

`8.W` 是一个宽度描述，表示 8 位。常量也可以写出宽度：

```scala
val zero = 0.U(8.W)
val one = 1.U(8.W)
val mask = "hff".U(8.W)
```

位选择和拼接：

```scala
val high = value(7, 4)
val low = value(3, 0)
val wide = Cat(value, value)
```

Chisel 会在生成硬件时处理位宽推导，但不要把位宽全部交给工具猜。尤其是 RISC-V 的指令、地址和立即数字段，最好在接口处明确写出宽度。

## 3. 组合逻辑和 Wire

`Wire` 表示组合逻辑中的中间信号：

```scala
class AddSub extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(32.W))
    val b = Input(UInt(32.W))
    val sub = Input(Bool())
    val y = Output(UInt(32.W))
  })

  val result = Wire(UInt(32.W))
  result := io.a + io.b

  when (io.sub) {
    result := io.a - io.b
  }

  io.y := result
}
```

`when` 描述条件连接。这里 `result` 先有默认值，在 `io.sub` 为真时改用减法结果。给组合信号一个默认连接，能避免遗漏条件。

也可以用 `Mux`：

```scala
io.y := Mux(io.sub, io.a - io.b, io.a + io.b)
```

`Mux` 对应硬件里的多路选择器。`when` 适合表达多段条件逻辑，`Mux` 适合简单的二选一。

## 4. 寄存器：Reg 和 RegInit

组合逻辑没有记忆。需要在时钟周期之间保存值时，使用 `Reg`：

```scala
class Register32 extends Module {
  val io = IO(new Bundle {
    val enable = Input(Bool())
    val d = Input(UInt(32.W))
    val q = Output(UInt(32.W))
  })

  val q = Reg(UInt(32.W))
  when (io.enable) {
    q := io.d
  }
  io.q := q
}
```

`Reg(UInt(32.W))` 创建一个 32 位寄存器。每次时钟沿到来时，如果 `enable` 为真，寄存器采样 `io.d`。

需要初始值时使用 `RegInit`：

```scala
val count = RegInit(0.U(8.W))
count := count + 1.U
```

复位行为由 Chisel 和目标平台的配置决定，但 `RegInit` 表达了这个寄存器需要一个初始值。写一个 CPU 时，PC、流水线有效位和状态机状态通常都会有明确的初始化值。

## 5. Scala 的 if 和 Chisel 的 when

这是初学者最容易混淆的地方：

```scala
if (width == 32) {
  // 构造 32 位硬件
}

when (io.enable) {
  // 运行时硬件条件
}
```

Scala 的 `if` 在生成硬件之前执行。它适合根据参数选择硬件结构。`when` 会生成硬件里的条件逻辑，条件来自输入或寄存器。

例如：

```scala
class ParamAdder(width: Int) extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(width.W))
    val b = Input(UInt(width.W))
    val y = Output(UInt(width.W))
  })

  if (width == 32) {
    io.y := io.a + io.b
  } else {
    io.y := io.a + io.b
  }
}
```

这段 Scala `if` 不会生成一个运行时选择器。Chisel 在构造模块时就知道 `width`。

## 6. Bundle：给接口分组

RISC-V 的流水线数据通常不止一个字段。用 `Bundle` 可以把它们放在一起：

```scala
class DecodeToExecute extends Bundle {
  val pc = UInt(32.W)
  val rs1 = UInt(32.W)
  val rs2 = UInt(32.W)
  val rd = UInt(5.W)
  val aluOp = UInt(4.W)
  val valid = Bool()
}
```

模块接口可以直接使用这个 Bundle：

```scala
class ExecuteStage extends Module {
  val io = IO(new Bundle {
    val in = Input(new DecodeToExecute)
    val result = Output(UInt(32.W))
  })

  io.result := io.in.rs1 + io.in.rs2
}
```

这比把十几个端口平铺在模块定义里更容易维护。字段名也会留在生成的结构中，读波形和排查连接错误时更方便。

Bundle 默认是无方向的。作为 `Input` 或 `Output` 使用后，Chisel 会根据外层方向解释其中字段的方向。需要双向或混合方向接口时，可以使用 `Flipped`。

## 7. Vec：构造寄存器堆和端口数组

`Vec` 表示一组相同类型的硬件元素：

```scala
class RegisterFile extends Module {
  val io = IO(new Bundle {
    val raddr1 = Input(UInt(5.W))
    val raddr2 = Input(UInt(5.W))
    val rdata1 = Output(UInt(32.W))
    val rdata2 = Output(UInt(32.W))
    val wen = Input(Bool())
    val waddr = Input(UInt(5.W))
    val wdata = Input(UInt(32.W))
  })

  val regs = RegInit(VecInit(Seq.fill(32)(0.U(32.W))))

  when (io.wen && io.waddr =/= 0.U) {
    regs(io.waddr) := io.wdata
  }

  io.rdata1 := Mux(io.raddr1 === 0.U, 0.U, regs(io.raddr1))
  io.rdata2 := Mux(io.raddr2 === 0.U, 0.U, regs(io.raddr2))
}
```

`Seq.fill(32)` 是 Scala 集合操作，它在构造时生成 32 个初始值。`regs(io.waddr)` 是硬件索引，综合后会形成寄存器堆的读写结构。

注意两个括号里的东西不是同一类计算：`Seq.fill` 在生成硬件之前运行，`regs(io.waddr)` 是硬件运行时的动态访问。

## 8. Module 复用和参数化

Chisel 的一个优点是可以用 Scala 参数复用模块：

```scala
class Adder(width: Int) extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(width.W))
    val b = Input(UInt(width.W))
    val y = Output(UInt(width.W))
  })

  io.y := io.a + io.b
}

class Top extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(32.W))
    val b = Input(UInt(32.W))
    val y = Output(UInt(32.W))
  })

  val adder = Module(new Adder(32))
  adder.io.a := io.a
  adder.io.b := io.b
  io.y := adder.io.y
}
```

`Adder` 并不只适用于 32 位。`new Adder(64)` 会构造一个 64 位版本。这里的参数化是生成多个硬件结构，不是让一个硬件模块在运行时改变位宽。

## 9. Decoupled：valid 和 ready

流水线、FIFO 和模块之间常用 `valid/ready` 握手：

```text
发送方 valid=1 ───────> 接收方
发送方 <──────── ready=1 接收方

只有 valid && ready 同时为 1，数据才真正传输。
```

Chisel 提供了 `Decoupled`：

```scala
class Producer extends Module {
  val io = IO(new Bundle {
    val out = Decoupled(UInt(32.W))
  })

  io.out.valid := true.B
  io.out.bits := 42.U
}

class Consumer extends Module {
  val io = IO(new Bundle {
    val in = Flipped(Decoupled(UInt(32.W)))
  })

  io.in.ready := true.B
  when (io.in.fire) {
    printf("received %d\\n", io.in.bits)
  }
}
```

`fire` 等价于 `valid && ready`。`Flipped` 把接口方向翻转，让接收方使用输入方向。

真实设计中，发送方不能因为接收方暂时不 ready 就丢掉数据。接收方也不能把 ready 写死成 true，除非它确实每个周期都能接收。这个握手规则是连接 RISC-V 流水线各级时很重要的一层约束。

## 10. 状态机和 ChiselEnum

状态机可以用 `ChiselEnum` 表达：

```scala
object State extends ChiselEnum {
  val idle, run, done = Value
}

class SimpleFsm extends Module {
  val io = IO(new Bundle {
    val start = Input(Bool())
    val busy = Output(Bool())
  })

  val state = RegInit(State.idle)

  switch (state) {
    is (State.idle) {
      when (io.start) {
        state := State.run
      }
    }
    is (State.run) {
      state := State.done
    }
    is (State.done) {
      state := State.idle
    }
  }

  io.busy := state === State.run
}
```

`switch` 和 `is` 描述状态转移。状态寄存器使用 `RegInit` 初始化。和 Verilog 的 FSM 一样，最好保证每个状态都有明确的转移路径。

## 11. 生成 Verilog 与测试

Chisel 项目一般使用 Scala 构建工具管理依赖。一个很小的生成入口可能是：

```scala
object Main extends App {
  emitVerilog(new Register32)
}
```

生成命令和 Chisel 版本有关，实际项目里常见的是 `sbt run` 或 `sbt test`。测试可以使用 ChiselTest：

```scala
class Register32Test extends AnyFlatSpec with ChiselScalatestTester {
  "Register32" should "store data when enabled" in {
    test(new Register32) { dut =>
      dut.io.enable.poke(true.B)
      dut.io.d.poke(42.U)
      dut.clock.step()
      dut.io.q.expect(42.U)
    }
  }
}
```

测试代码运行在 Scala 环境中，不会直接成为硬件。`poke` 驱动输入，`step` 推进时钟，`expect` 检查输出。

## 12. Chisel 中最容易犯的错误

第一，把 Scala 计算和硬件计算混在一起。`width + 1` 可能是在生成阶段算一个整数，`io.a + 1.U` 才是在硬件里做加法。

第二，忘记写连接。声明 `Wire`、`Reg` 或输出端口后，如果没有给它连接，工具会报错或留下不完整的硬件。

第三，忽略位宽。`UInt` 的宽度会影响加法、截取和模块连接，调试时要直接看生成的 RTL 和编译器报告。

第四，把 `when` 当成普通 Scala `if`。`when` 表示硬件条件，块里的连接仍然会参与电路生成。

第五，只看 Scala 代码，不看生成的 Verilog。Chisel 的抽象层很有用，但最终电路还是要读波形、跑仿真、检查时序和综合结果。

Chisel 的学习顺序可以很简单：先写组合模块，再写寄存器；接着练 Bundle、Vec 和 Module 复用；最后用 Decoupled 连接流水线。掌握这些之后，再去看 Rocket Chip 或 BOOM 这类大项目，至少能看懂它们在构造什么硬件。

在这个专栏里，Verilog 负责让你直接看到 RTL，BSV 负责练习规则和并发，Chisel 负责练习参数化构造。后续三篇文章会围绕同一个 ALU、寄存器堆和流水线模块继续比较。

## 13. Scala 基础：val、def 和类型参数

Chisel 运行在 Scala 环境中。你不必先学完整个 Scala，但至少要认识这些写法：

```scala
val width = 32
def add(a: Int, b: Int): Int = a + b
val lanes = Seq.fill(4)(0)
```

`val` 定义不可重新绑定的值，`def` 定义函数，`Seq.fill` 在构造阶段创建集合。它们通常在生成硬件之前执行。

硬件信号使用 Chisel 类型：

```scala
val a: UInt = Wire(UInt(32.W))
val enable: Bool = IO(Input(Bool()))
```

不要把 Scala 的 `Int` 和 Chisel 的 `UInt` 混为一谈。`Int` 是生成程序里的整数，`UInt` 是将被生成的硬件信号。

## 14. SInt、类型转换和位宽

Chisel 提供无符号 `UInt`、有符号 `SInt` 和布尔类型 `Bool`：

```scala
val unsigned = Wire(UInt(8.W))
val signed = Wire(SInt(8.W))
val asSigned = unsigned.asSInt
val asUnsigned = signed.asUInt
```

常见位宽操作：

```scala
val low = value(7, 0)
val extended = value.pad(32)
val narrowed = value(15, 0)
val combined = Cat(high, low)
```

`pad` 会扩展到至少指定宽度，切片会丢掉其他位。对于地址、立即数和算术结果，先明确符号扩展还是零扩展，再写转换代码。

## 15. 连接运算符和默认连接

`:=` 是普通单向连接，常见于输出和内部信号：

```scala
io.out := io.in
```

连接 Bundle 时，可以使用 `<>` 或 `:#=` 等接口连接方式，但初学时应先确认每个字段的方向。更推荐给接口定义清楚方向，再按字段连接，这样错误信息更容易读。

组合逻辑最好先给默认连接：

```scala
val next = Wire(UInt(32.W))
next := 0.U
when (io.valid) {
  next := io.data
}
```

如果一个 Wire 在所有路径上没有值，Chisel 会在 elaboration 或 FIRRTL 检查阶段报告问题。

## 16. when、elsewhen 和 otherwise

条件硬件可以写成：

```scala
when (io.op === 0.U) {
  io.y := io.a + io.b
}.elsewhen (io.op === 1.U) {
  io.y := io.a - io.b
}.otherwise {
  io.y := 0.U
}
```

这些条件按顺序表达优先级。也可以使用 `Mux`：

```scala
io.y := Mux(io.sub, io.a - io.b, io.a + io.b)
```

`when` 不是 Scala `if`。它会在生成的硬件中留下条件选择逻辑。

## 17. switch、is 和状态机

多路选择或状态机通常使用 `switch`：

```scala
switch (io.op) {
  is (0.U) { io.y := io.a + io.b }
  is (1.U) { io.y := io.a - io.b }
  is (2.U) { io.y := io.a & io.b }
  is (3.U) { io.y := io.a | io.b }
}
```

复杂状态机可以使用 `ChiselEnum`：

```scala
object State extends ChiselEnum {
  val idle, fetch, execute, commit = Value
}

val state = RegInit(State.idle)
switch (state) {
  is (State.idle) { state := State.fetch }
  is (State.fetch) { state := State.execute }
  is (State.execute) { state := State.commit }
  is (State.commit) { state := State.idle }
}
```

## 18. Reg、RegNext 和寄存器使能

除了 `Reg` 和 `RegInit`，Chisel 还提供 `RegNext`：

```scala
val delayed = RegNext(io.in)
val delayedWithReset = RegNext(io.in, 0.U)
```

这表示一个输入经过一个时钟周期后出现在输出。带使能的寄存器可以写成：

```scala
val q = Reg(UInt(32.W))
when (io.enable) {
  q := io.d
}
```

没有赋值的时钟周期会保持原值。这和寄存器的 enable 引脚相对应，不是 latch。

## 19. Bundle、Flipped 和方向

Bundle 用来表达结构化数据：

```scala
class Request extends Bundle {
  val addr = UInt(32.W)
  val write = Bool()
  val wdata = UInt(32.W)
}

class MemoryPort extends Bundle {
  val req = Decoupled(new Request)
  val resp = Flipped(Decoupled(UInt(32.W)))
}
```

`Flipped` 会翻转字段方向。它常用于把同一个接口类型分别用在 master 和 slave 两侧。

`Bundle` 中的字段不需要写 `Input` 或 `Output`，外层 `IO` 的方向会决定整体方向。涉及嵌套接口时，要重点检查每一层的方向是否符合连接关系。

## 20. VecInit、Mem 和 SyncReadMem

`VecInit` 适合初始化寄存器向量：

```scala
val regs = RegInit(VecInit(Seq.fill(32)(0.U(32.W))))
```

`Mem` 和 `SyncReadMem` 用于更大的存储结构：

```scala
val asyncMem = Mem(256, UInt(32.W))
val syncMem = SyncReadMem(256, UInt(32.W))

when (io.wen) {
  asyncMem.write(io.waddr, io.wdata)
}
io.rdata := asyncMem.read(io.raddr)
```

同步读存储器的读数据会在之后的时钟周期返回。不要把同步读和组合读混用，否则流水线时序会和预期不同。

## 21. 参数化、trait 和 helper

参数化是 Chisel 的主要优势：

```scala
class Alu(width: Int, enableMul: Boolean) extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(width.W))
    val b = Input(UInt(width.W))
    val y = Output(UInt(width.W))
  })

  if (enableMul) {
    io.y := io.a * io.b
  } else {
    io.y := io.a + io.b
  }
}
```

这里 `enableMul` 是 Scala 参数，所以它决定生成乘法器还是加法器；它不是一个运行时选择信号。

可以用普通 Scala 函数抽取重复的硬件构造：

```scala
def zeroWhen(cond: Bool, value: UInt): UInt = {
  Mux(cond, 0.U(value.getWidth.W), value)
}
```

helper 函数应保持简单，并明确它返回的是硬件节点还是 Scala 值。

## 22. Decoupled 和 ready/valid

`DecoupledIO` 是 Chisel 中常见的流接口：

```scala
val input = IO(Flipped(Decoupled(UInt(32.W))))
val output = IO(Decoupled(UInt(32.W)))

output.bits := input.bits
output.valid := input.valid
input.ready := output.ready
```

更实际的传输逻辑通常需要寄存器或 FIFO 来保存尚未被接收的数据。传输发生的条件是：

```scala
when (input.fire) {
  // input.valid && input.ready
}
```

如果输出没有 ready，发送方必须保持 bits 和 valid 不变，直到握手成功。这个规则是 RISC-V 流水线阻塞和 backpressure 的基础。

## 23. Queue、Irrevocable 和 Flipped

Chisel 标准库提供 `Queue`：

```scala
val queue = Module(new Queue(UInt(32.W), entries = 4))
queue.io.enq <> io.input
queue.io.deq <> io.output
```

`Queue` 会处理存储、空满和 ready/valid。接口连接使用 `<>` 时，需要确认两侧方向能够匹配。

`Irrevocable` 比 `Decoupled` 多一个约束：当 valid 为真但 ready 为假时，数据和 valid 必须保持稳定。跨模块协议中使用它前，应确保发送方真的满足这个约束。

## 24. 时钟和复位

普通模块默认使用 `clock` 和 `reset`。需要显式时钟域时，可以使用 `withClock` 和 `withReset`：

```scala
withClock(io.clock) {
  val counter = RegInit(0.U(8.W))
  counter := counter + 1.U
}
```

不同 clock domain 之间不能直接连接普通寄存器。需要同步器、异步 FIFO 或专门的 CDC 结构。Chisel 只构造硬件，不会自动消除亚稳态风险。

## 25. Module 的生命周期和 IO 组织

每个 `Module` 都有自己的 IO 和内部节点。通常把一个功能模块拆成：

```text
顶层 Module
 ├── 控制器 Module
 ├── 数据通路 Module
 ├── 寄存器堆 Module
 └── 存储接口 Module
```

父模块通过 `Module(new Child(...))` 创建子模块，再连接子模块 IO。不要在子模块外部直接访问子模块的内部 Wire 或 Reg，应该把需要的信息放进 IO 或 Bundle。

## 26. 编译期 Scala 和硬件运行时的边界

下面两段代码都包含 `if`，含义完全不同：

```scala
if (width == 32) {
  io.out := io.a
} else {
  io.out := io.b
}

when (io.select) {
  io.out := io.a
}.otherwise {
  io.out := io.b
}
```

第一个 `if` 在生成硬件时就完成选择，最终电路只保留一个分支。第二个 `when` 会生成运行时的选择逻辑。

理解这个边界，才能正确使用 Scala 循环生成多个端口，又不会误以为硬件会在运行时执行 Scala 代码。

## 27. 测试、断言和生成的 Verilog

ChiselTest 常用 `poke`、`peek`、`expect` 和 `clock.step`：

```scala
dut.io.in.poke(10.U)
dut.clock.step()
dut.io.out.expect(10.U)
```

断言可以直接写在硬件中：

```scala
when (io.valid) {
  assert(io.data =/= 0.U)
}
```

测试通过并不代表硬件一定正确。仍然需要查看生成的 Verilog，检查寄存器数量、组合路径、存储器推导和接口时序。

## 28. Chisel 常见错误清单

- 把 Scala `Int` 当成硬件 `UInt`；
- 把 Scala `if` 当成硬件条件；
- 忘记给 Wire 或输出端口默认连接；
- 使用错误位宽或错误的有符号转换；
- `Decoupled` 的 ready/valid 方向接反；
- 把同步读存储器当成组合读使用；
- 忽略 `RegInit` 带来的复位语义；
- 只运行 Scala 测试，不检查生成的 RTL；
- 用普通寄存器直接跨时钟域连接。

这些内容覆盖了日常 Chisel RTL 中最常用的语言和库抽象。继续学习时，可以用相同的 ALU、寄存器堆和五级流水线分别实现三次，再对比每种语言在结构复用、并发控制和验证方式上的差异。
