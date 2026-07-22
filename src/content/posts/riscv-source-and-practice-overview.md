---
title: RISC-V 学习路线：从指令集到系统实战
published: 2026-07-22
description: RISC-V：从指令集到系统实战专辑的总览，建立从基础指令、特权架构到 QEMU、汇编和 xv6 实验的学习路线。
image: ''
tags:
  - RISC-V
  - ISA
  - QEMU
  - xv6
category: riscv
series: riscv-source-and-practice
seriesOrder: 1
lang: zh_CN
draft: false
---

# 为什么单独学习 RISC-V

Linux 启动链路专辑以 RISC-V 作为主要实验架构，但这并不意味着可以跳过 RISC-V 本身。Linux 源码中的启动入口、寄存器、异常、中断和页表实现，都建立在具体的指令集和特权架构之上。

这套专辑专门补齐这部分基础：先理解 RISC-V 处理器提供了什么，再回到操作系统源码中观察 Linux 和 xv6 如何使用这些机制。

如果想进一步理解指令在硬件中如何执行，请转到 [RISC-V CPU：从五级流水线到乱序多发](/series/riscv-cpu-microarchitecture/)。CPU 专辑负责 RTL、流水线、Cache、乱序执行和多发射；本专辑负责指令集与特权架构，二者共同构成从硬件到软件的基础。

当需要把这些架构语义落实为硬件时，可以继续阅读 [RISC-V 硬件设计语言：Verilog、Chisel 与 BSV](/series/riscv-hardware-languages/)，对比三种语言如何实现同一个 CPU 模块。

## 专辑主线

```text
RV32I / RV64I 基础指令
        ↓
寄存器、函数调用与汇编
        ↓
特权级（M / S / U）
        ↓
异常、中断与 CSR
        ↓
虚拟内存与 Sv39 页表
        ↓
QEMU virt 与设备树
        ↓
xv6 启动与 Linux RISC-V 启动
```

## 主要内容

### 1. 基础指令集与汇编

从整数寄存器、立即数、加载存储、分支跳转和函数调用约定开始，使用 RISC-V 汇编和交叉工具链编译最小程序。

### 2. 特权架构

理解 M-mode、S-mode 和 U-mode 的职责，认识 CSR、`ecall`、`mret`、`sret` 以及操作系统为什么需要特权级切换。

### 3. 异常与中断

通过定时器中断、系统调用和非法指令实验，观察 trap 入口、上下文保存、原因寄存器和返回路径。

### 4. 虚拟内存

从地址转换和页表项开始，理解 Sv39、SATP、页表映射与缺页异常，为 Linux 内存管理专辑提供架构基础。

### 5. QEMU virt 平台

使用 `qemu-system-riscv64` 启动裸机程序、xv6 和 Linux，结合设备树理解 CLINT、PLIC、UART 和 virtio 等设备如何呈现给软件。

### 6. 从 xv6 过渡到 Linux

xv6 适合作为小型、可读的实验系统。我们会先追踪它的启动汇编、页表、trap 和调度，再把相同问题映射到 Linux RISC-V 的实现中。

## 实验工具

- RISC-V GNU toolchain；
- `qemu-system-riscv64`；
- GDB 与 OpenOCD（必要时）；
- xv6-riscv；
- Linux 源码；
- `objdump`、`readelf` 和 `make`。

这套专辑关注的是“软件如何使用硬件提供的机制”。掌握这条线之后，再阅读 Linux 的 `arch/riscv/`、启动汇编、页表和异常处理代码时，就能理解代码背后的硬件约束，而不是只记住函数名。
