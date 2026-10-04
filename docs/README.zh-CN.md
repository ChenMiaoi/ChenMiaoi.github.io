[English](../README.md) · **简体中文** · [日本語](README.ja.md)

<img align="right" src="../public/avatar.jpg" width="112" alt="Chen Miao 的头像" />

# 你好，我是 Chen Miao

**操作系统 · 内核 · 驱动 · 底层工程**

我是一名对操作系统和底层架构着迷的程序员，喜欢贴近硬件写代码。常用 C/C++、Rust 和 Linux，关注系统的性能、可靠性，以及软件与硬件交界处的那些细节。

**让我来驱动你的世界。**<br />
Let me drive your world.

[个人博客](https://nyachen.cn/) · [GitHub](https://github.com/ChenMiaoi) · [知乎](https://www.zhihu.com/people/Pigeon/posts) · [Email](mailto:chenmiao.ku@gmail.com)

## 我关注的方向

- **Linux 内核与操作系统**：启动流程、内存管理、文件系统和设备驱动。沿着一次具体操作的执行路径，理解各个子系统如何协作。
- **体系结构与硬件设计**：RISC-V、CPU 微架构，以及 Verilog、Chisel、Bluespec SystemVerilog。把指令、流水线与实际的硬件描述联系起来。
- **系统编程与工具链**：C/C++、Rust、内核构建与底层调试。关注代码在真实系统中的行为，以及实现背后的约束。

## 我的技术笔记

[Miao's Blog](https://nyachen.cn/) 是我整理源码阅读、学习与实践的地方。我希望把一个问题从现象写到实现：它经过哪些路径，依赖哪些结构，又为什么被设计成这样。

你可以从这些文章开始了解我在研究和记录的内容：

- [Linux 是如何启动的：从上电到 init 进程](https://nyachen.cn/2026/07/22/linux-beginner-boot-overview/)：沿着启动过程，梳理硬件、内核与用户空间之间的衔接。
- [VFS 的六大核心对象](https://nyachen.cn/2026/08/26/linux-modern-vfs-six-core-objects/)：从对象关系入手，理解 Linux 文件系统的公共抽象。
- [RISC-V 硬件设计语言总览：Verilog、Chisel 与 Bluespec SystemVerilog](https://nyachen.cn/2026/07/22/riscv-hardware-languages-overview/)：梳理不同硬件描述方式的特点与学习路径。

更多内容可以在 [文章归档](https://nyachen.cn/archive/) 和 [专题系列](https://nyachen.cn/series/) 中找到。

## 开源实践

我参与过的 Linux 内核工作包括：

- **OpenRISC**：添加 [text patching API](https://github.com/torvalds/linux/commit/4735037b5d9)、[PC-relative 模块重定位](https://github.com/torvalds/linux/commit/9d0cb6d00be) 和 [jump label](https://github.com/torvalds/linux/commit/8c30b0018f9) 支持。
- **Rust for Linux / kbuild**：修正 [mrproper 对 libpin_init_internal 的清理](https://github.com/torvalds/linux/commit/a44bfed9df8)。

提交、补丁讨论和其他开源活动整理在 [贡献记录](https://nyachen.cn/contribution/) 中。

## 找到我

如果你也在读内核、做驱动，或研究软硬件之间的细节，欢迎交流；文章中的错误与不同理解，也欢迎指出。

- **Email**：[chenmiao.ku@gmail.com](mailto:chenmiao.ku@gmail.com)
- **GitHub**：[@ChenMiaoi](https://github.com/ChenMiaoi)
- **知乎**：[我的文章](https://www.zhihu.com/people/Pigeon/posts)

---

这个仓库存放我的博客源码。站点开发、写作和部署说明见 [维护文档](development.md)。
