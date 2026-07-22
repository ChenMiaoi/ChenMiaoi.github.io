---
title: RISC-V CPU 学习路线：从五级流水线到乱序多发
author: Chen Miao
published: 2026-07-22T19:42:15+08:00
description: RISC-V CPU：从五级流水线到乱序多发专辑总览，建立从 RTL 数据通路到 QEMU、仿真验证和 Linux 运行时行为的连接。
image: ''
tags:
  - RISC-V
  - CPU
  - 五级流水线
  - 乱序执行
  - Verilog
category: cpu
series: riscv-cpu-microarchitecture
seriesOrder: 1
lang: zh_CN
draft: false
---

# 为什么还需要一套 CPU 专辑


具体使用哪些硬件设计语言实现这些模块，见 [RISC-V 硬件设计语言：Verilog、Chisel 与 BSV](/series/riscv-hardware-languages/)。该专栏会让三种语言围绕相同的 RISC-V CPU 模块展开，保留统一的测试与验证方法。
Linux 和 RISC-V 专辑主要回答两个问题：软件如何使用指令集，操作系统如何管理硬件资源。但指令真正执行时，还要经过 CPU 内部的数据通路、流水线、缓存和执行单元。

因此，本专辑从 **RISC-V CPU 的硬件实现**出发，使用 RTL、仿真器和 FPGA/ASIC 设计中常见的方法，逐步构建一个能运行真实程序的处理器。它与 Linux、RISC-V 两套专辑不是并列孤岛，而是硬件向上支撑软件的第三条线。

## 三套专辑如何连接

```text
RISC-V CPU：RTL、流水线、乱序执行
                ↓ 提供指令执行、异常、中断和内存访问
RISC-V：指令集、特权架构、页表、QEMU virt
                ↓ 提供架构语义和运行平台
Linux：启动、进程、内存、文件系统、驱动、网络
```

具体来说：

- CPU 专辑实现的 `ecall`、异常、中断和 CSR，会在 RISC-V 专辑中被解释为架构行为；
- RISC-V 专辑中的页表、特权级和 QEMU `virt`，会在 Linux 专辑中成为 `arch/riscv/` 和启动流程的基础；
- Linux 专辑中的调度、系统调用和内存访问，会反过来成为 CPU 验证微体系结构的真实软件负载。

## 主要阶段

### 1. 从单周期 CPU 开始

先实现 RV32I 或 RV64I 的最小指令子集，建立 PC、寄存器堆、ALU、指令存储器和数据存储器之间的数据通路。通过汇编测试确认每条指令的语义。

### 2. 五级流水线

将处理器划分为经典的 Fetch、Decode、Execute、Memory、Writeback 五个阶段，并处理流水线寄存器、数据冒险、控制冒险、转发、停顿和冲刷。

实验目标不是画出流水线示意图，而是让 CPU 在仿真中正确执行连续的 RISC-V 指令流，并用波形解释每个周期发生了什么。

### 3. 异常、中断与特权支持

为了运行更真实的软件，需要实现必要的 CSR、trap 入口、异常原因保存和返回机制。这里会与 RISC-V 特权架构专辑直接衔接，再通过裸机程序和 xv6 验证。

### 4. Cache 与存储层次

在流水线稳定后加入指令 Cache、数据 Cache、访存握手和必要的阻塞处理，理解 CPU 与内存延迟之间的关系。后续还可以连接 Linux 的 page cache，但要区分硬件 Cache 与操作系统页缓存。

### 5. 多发射与乱序执行

在顺序流水线的基础上，逐步引入多个发射槽、保留站、寄存器重命名、执行单元、ROB 和按序提交，处理结构、数据和控制依赖。

乱序执行不是简单地“同时执行更多指令”。必须保证异常精确、分支恢复和内存顺序正确，否则操作系统看到的寄存器和内存状态就会出错。

### 6. 用真实软件验证

验证顺序会从单元测试、指令测试、汇编测试开始，逐步运行裸机程序、xv6，最后尝试运行面向 RISC-V 的 Linux 内核和用户空间程序。每一次扩展都要保留可重复的仿真测试和波形证据。

## 推荐工具

- SystemVerilog / Verilog RTL；
- Verilator 或 iverilog 仿真；
- GTKWave 波形查看；
- RISC-V GNU toolchain；
- QEMU `virt`；
- GDB；
- xv6-riscv 与 Linux 源码。

这套专辑最终要建立的是一条完整的因果链：一条 RISC-V 指令如何在流水线中流动，如何触发异常或访存，如何被特权架构暴露给操作系统，以及 Linux 如何通过这些机制启动并运行应用程序。
