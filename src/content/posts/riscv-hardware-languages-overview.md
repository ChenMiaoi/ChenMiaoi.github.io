---
title: RISC-V 硬件设计语言总览：Verilog、Chisel 与 Bluespec SystemVerilog
published: 2026-07-22
description: RISC-V 硬件设计语言专栏总览，介绍 Verilog、Chisel 与 Bluespec SystemVerilog（BSV）的定位，并规划如何用三种方式实现同一套 RISC-V CPU。
image: ''
tags:
  - RISC-V
  - Verilog
  - Chisel
  - BSV
  - RTL
category: hardware-language
series: riscv-hardware-languages
seriesOrder: 1
lang: zh_CN
draft: false
---

# 为什么需要单独讨论硬件设计语言

如果想先了解这些语言最终要实现的处理器结构，请阅读 [RISC-V CPU：从五级流水线到乱序多发](/series/riscv-cpu-microarchitecture/)。CPU 专辑负责微体系结构，本专栏负责用不同语言把这些结构落实为 RTL。

CPU 专辑关注流水线如何组织、冒险如何处理、乱序执行如何提交；本专栏关注同一套 RISC-V CPU 如何使用不同的硬件设计语言表达、生成、仿真和验证。

因此，这不是三门语言的语法合集，而是一条围绕同一个 CPU 项目的对比学习路线：

```text
同一条 RISC-V 指令 / 同一个 CPU 模块
             ↓
Verilog       Chisel       Bluespec SystemVerilog（BSV）
             ↓
生成或实现 RTL、仿真、波形验证
             ↓
裸机程序 → xv6 → Linux
```

## 三门语言的角色

## 1. Verilog：直接描述 RTL

Verilog 是硬件实现的基础入口。我们会从组合逻辑、时序逻辑、寄存器、模块和有限状态机开始，逐步实现 RV32I / RV64I 的数据通路。

重点是建立 RTL 思维：一个 `always_ff` 描述时钟边沿的状态更新，一个 `always_comb` 描述组合逻辑；流水线寄存器、转发和冲刷最终都要落实为可综合的硬件结构。

后续实验包括：

- 最小 ALU 和寄存器堆；
- 单周期 RISC-V CPU；
- 五级流水线；
- 数据冒险与控制冒险；
- 仿真、波形和综合检查。

## 2. Chisel：用 Scala 构造参数化硬件

Chisel 更准确地说是基于 Scala 的硬件构造语言。它可以用普通编程语言的抽象能力描述参数化硬件，并最终生成 Verilog 或其他 RTL 表示。

我们会关注：

- `Module`、`Bundle`、`UInt` 和 `Vec`；
- 参数化数据通路；
- 模块复用与接口组织；
- Chisel 到 FIRRTL / CIRCT 再到 Verilog 的生成链路；
- Rocket Chip、BOOM 等 RISC-V 项目的结构。

Chisel 不是把 Verilog 换成 Scala 语法，而是改变了构造和复用硬件的方式。

## 3. Bluespec SystemVerilog（BSV）：规则驱动的硬件描述

BSV 是 Bluespec 体系中的规则驱动硬件描述语言，与 RISC-V 指令集没有从属关系。它适合表达并发、原子和带条件的硬件行为。

我们会学习：

- `rule` 与 guarded atomic action；
- `method` 与 `interface`；
- 规则之间的冲突和调度；
- 流水线控制；
- 发射、执行和提交之间的并发关系。

BSV 的思维方式不同于逐时钟手工安排所有控制信号：先描述满足条件时可以原子执行的规则，再由工具分析规则调度。这尤其适合讨论流水线和乱序 CPU 中的并发行为。

## 同一个模块，三种表达

专栏会尽量让三门语言围绕相同模块展开，而不是各写一套互不相关的示例：

| 模块 | Verilog | Chisel | Bluespec SystemVerilog（BSV） |
| --- | --- | --- | --- |
| ALU | 直接描述组合逻辑 | 参数化硬件构造 | 方法和规则组合 |
| 寄存器堆 | 时序读写与端口 | Bundle / Vec 参数化 | interface 与 method |
| 五级流水线 | 手工管理流水线寄存器 | 模块化生成数据通路 | 规则驱动流水推进 |
| Cache | 状态机与时序控制 | 参数化组相联结构 | 规则和冲突调度 |
| 乱序执行 | 显式控制队列和状态 | 生成可复用结构 | 原子规则表达并发 |

## 与其他专辑的连接

```text
RISC-V 硬件设计语言
  ├── Verilog：直接 RTL
  ├── Chisel：参数化硬件生成
  └── Bluespec SystemVerilog：规则驱动硬件
              ↓
RISC-V CPU：从五级流水线到乱序多发
              ↓
RISC-V：指令集、特权架构、异常、中断、页表
              ↓
Linux：启动、进程、内存、文件系统、驱动、网络
```

CPU 专辑决定“实现什么微体系结构”；本专栏决定“用什么方式表达和生成硬件”；RISC-V 专辑解释“软件可见的架构语义”；Linux 专辑则验证这些机制能否支撑真实操作系统。

后续每个阶段都应当保留统一的测试程序、仿真结果和波形证据，最终让同一套 RISC-V 指令流能够在不同实现中得到一致的架构行为。
