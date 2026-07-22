---
title: Chisel 语法详解：Scala、硬件节点与参数化构造
published: 2026-07-22T22:42:00+08:00
description: 从 Scala 与 Chisel 的阶段边界出发，详解类型、连接、条件、寄存器、Bundle、Vec、存储器、接口、参数化和验证语法。
image: ''
tags:
  - Chisel
  - Scala
  - RTL
  - RISC-V
category: hardware-language
series: riscv-chisel-syntax
seriesOrder: 2
lang: zh_CN
draft: false
---

Chisel 最奇妙的语法来自两个世界叠在一起：Scala 程序在 elaboration 阶段运行，`UInt`、`Bool`、`Reg` 和 `Bundle` 则代表将要生成的硬件。先分清“现在运行的 Scala”和“未来运行的电路”，大多数语法才不会混淆。

## 1. Scala 值与硬件值

```scala
val width: Int = 32       // Scala 生成期整数
val lanes = Seq.fill(4)(0) // 生成期集合
val a: UInt = Wire(UInt(width.W)) // 硬件节点
```

`width + 1` 是 Scala 运算，`a + 1.U` 是硬件加法。Scala `if`、`for`、`map`、类构造器和函数在生成模块时执行；`when`、`Mux`、`switch`、`Reg` 则留下硬件结构。

`val` 不可重新绑定，`var` 是可变 Scala 变量；二者都不是寄存器。硬件状态必须显式用 `Reg` 或 `RegInit`。

## 2. Module、IO、方向与命名

```scala
class Alu(width: Int) extends Module {
  val io = IO(new Bundle {
    val a = Input(UInt(width.W))
    val b = Input(UInt(width.W))
    val op = Input(UInt(2.W))
    val y = Output(UInt(width.W))
  })
  io.y := Mux(io.op === 0.U, io.a + io.b, io.a - io.b)
}
```

`Module` 是层次边界，`IO` 将 Bundle 变为端口。`Input`/`Output` 是方向构造器，不等于 Scala 的输入输出。模块实例用 `Module(new Alu(32))` 创建；子模块内部节点不能从父模块直接访问，必须放进 IO。

`IO` 和节点的命名会影响生成 Verilog。对调试重要的节点使用清晰的 `val` 名称，必要时使用 `suggestName`，但不要把名字当成功能契约。

## 3. UInt、SInt、Bool 和字面量

```scala
val u = Wire(UInt(8.W))
val s = Wire(SInt(8.W))
val b = Wire(Bool())
val x = 42.U(8.W)
val mask = "hff".U(8.W)
val neg = (-1).S(8.W)
```

`UInt`、`SInt` 是位向量；宽度 `8.W` 是 Scala 到 Chisel 的宽度字面量。未注明宽度的硬件常量可能依赖推导，接口和算术边界应显式规定。`asUInt`、`asSInt` 改变解释，`pad(n)` 扩展到至少 n 位，切片 `x(hi, lo)` 丢弃其他位。

`+` 与 `+&` 的进位宽度不同：前者通常保持结果宽度，后者保留额外进位。`+%`、`-%` 等操作明确截断语义；比较使用 `===`、`=/=`，不要把 Scala `==` 当作硬件比较。

## 4. Wire、:=、默认连接和优先级

```scala
val next = Wire(UInt(32.W))
next := 0.U
when (io.valid) { next := io.data }
io.out := next
```

`:=` 是单向连接。一个 Wire 可以在嵌套 `when` 中多次连接，后出现的有效条件会形成优先级覆盖；这不是 Scala 变量赋值。没有覆盖所有路径时，Chisel 的检查会报告未初始化连接。最稳妥的组合写法是先默认连接，再写条件覆盖。

`Mux(c, t, f)` 是二选一硬件 mux；`MuxCase`、`MuxLookup` 适合多路选择。Bundle 连接可用 `<>`，但必须先确认方向；现代代码也常按字段使用 `:=`，让错误更容易定位。

## 5. when、elsewhen、otherwise 与 switch

```scala
when (io.op === 0.U) {
  io.y := io.a + io.b
}.elsewhen (io.op === 1.U) {
  io.y := io.a - io.b
}.otherwise {
  io.y := 0.U
}
```

条件按书写顺序形成优先级。`when` 的条件必须是硬件 `Bool`，不能直接放 Scala `Boolean`；Scala `if` 则要求生成期布尔值。`switch`/`is` 可表达枚举或操作码选择，但同样需要默认连接防止遗漏。

## 6. Reg、RegInit、RegNext 与时钟域

```scala
val q = Reg(UInt(32.W))
when (io.en) { q := io.d }
val delayed = RegNext(io.d)
val state = RegInit(State.idle)
```

寄存器每个时钟沿采样下一连接；没有新连接时保持旧值。`RegInit` 同时声明复位初值，`RegNext(x, init)` 表示带初值的一拍延迟。`withClock`、`withReset`、`withClockAndReset` 可在局部创建不同域，但跨域仍需同步器或异步 FIFO，Chisel 不会消除亚稳态。

## 7. Bundle、Flipped、Vec 与自定义接口

```scala
class Request extends Bundle {
  val addr = UInt(32.W)
  val write = Bool()
  val data = UInt(32.W)
}
class Port extends Bundle {
  val req = Decoupled(new Request)
  val resp = Flipped(Decoupled(UInt(32.W)))
}
```

Bundle 字段默认无方向，外层 `Input`/`Output` 决定方向；`Flipped` 递归翻转方向，常用于 master/slave 两侧复用一个接口类型。`Vec(n, UInt(w.W))` 创建硬件向量，`VecInit(Seq.fill(n)(0.U(w.W)))` 适合初始化寄存器向量。`Vec` 的动态索引是硬件 mux，不是 Scala 数组访问。

## 8. Mem、SyncReadMem 与读写语义

```scala
val regs = RegInit(VecInit(Seq.fill(32)(0.U(32.W))))
val mem = Mem(1024, UInt(32.W))
val sync = SyncReadMem(1024, UInt(32.W))
when (io.wen) { mem.write(io.addr, io.wdata) }
io.rdata := mem.read(io.addr)
```

`Mem` 常表达组合读存储器，`SyncReadMem` 的读结果跨一个时钟周期返回。读写同址时的行为、端口数量和综合资源依赖目标后端，不要只凭 Chisel 源码假设 RAM 模式。`Reg(Vec(...))` 和 memory 也会影响复位成本。

## 9. Scala 集合、循环和参数化硬件

```scala
for (i <- 0 until lanes) {
  val unit = Module(new Alu(width))
  unit.io.a := io.a(i)
}
```

这个 `for` 生成固定数量实例；`lanes` 是 Scala 参数，不是运行时信号。普通 Scala 函数可以返回硬件节点：

```scala
def zeroWhen(c: Bool, x: UInt): UInt = Mux(c, 0.U(x.getWidth.W), x)
```

`trait`、case class、类型参数和隐式参数可以组织大型 generator，但应明确每个抽象最终生成什么硬件。根据参数用 Scala `if` 选择乘法器或加法器，会在生成结果中只保留一个分支；使用 `when` 才会生成运行时选择。

## 10. Decoupled、Irrevocable 与 Queue

```scala
val in = IO(Flipped(Decoupled(UInt(32.W))))
val out = IO(Decoupled(UInt(32.W)))
out.valid := in.valid
out.bits := in.bits
in.ready := out.ready
when (in.fire) { /* valid && ready */ }
```

`valid && ready` 才发生传输。发送端在 `valid && !ready` 时必须保持 `valid` 和 `bits`；`Irrevocable` 额外把这个稳定性约束写进接口语义。`Queue(gen, entries)` 提供缓冲和反压：

```scala
val q = Module(new Queue(UInt(32.W), 4))
q.io.enq <> in
q.io.deq <> out
```

连接 `<>` 前检查两端方向和字段类型，尤其是 `Flipped(Decoupled(...))` 的嵌套方向。

## 11. ChiselEnum、断言和测试

```scala
object State extends ChiselEnum { val idle, run, done = Value }
val state = RegInit(State.idle)
switch (state) {
  is (State.idle) { state := State.run }
  is (State.run) { state := State.done }
}
when (io.valid) { assert(io.data =/= 0.U) }
```

`ChiselEnum` 让状态名保留在 generator 中，并由后端编码。ChiselTest 中 `poke` 驱动输入，`peek` 读取值，`expect` 检查，`clock.step(n)` 推进时钟；测试 Scala 代码不会成为硬件。

## 12. 最容易忽略的边界

不要把 Scala `Int` 当 `UInt`；不要忘记 Wire、IO 和 Bundle 字段的连接；不要忽略 `+` 的位宽和 signed 转换；不要把 `Mem` 的读延迟当成固定事实；不要把 `Decoupled` 的 ready/valid 写反；不要把普通寄存器跨时钟域直连。生成 Verilog、FIRRTL/CIRCT 报告和波形都是语法理解的一部分：抽象写得越高，越要验证最终电路。