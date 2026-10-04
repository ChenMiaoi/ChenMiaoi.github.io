**English** · [简体中文](docs/README.zh-CN.md) · [日本語](docs/README.ja.md)

<img align="right" src="public/avatar.jpg" width="112" alt="Chen Miao's avatar" />

# Hi, I'm Chen Miao

**Operating Systems · Kernel · Drivers · Low-level Engineering**

I'm a programmer fascinated by operating systems and low-level architecture. I enjoy writing code close to the hardware, working with C/C++, Rust, and Linux. I'm interested in performance, reliability, and the details at the boundary between software and hardware.

**Let me drive your world.**

[Blog](https://nyachen.cn/) · [GitHub](https://github.com/ChenMiaoi) · [Zhihu](https://www.zhihu.com/people/Pigeon/posts) · [Email](mailto:chenmiao.ku@gmail.com)

## What I explore

- **Linux and operating systems**: boot sequences, memory management, filesystems, and device drivers. I follow concrete execution paths to understand how the subsystems work together.
- **Computer architecture and hardware design**: RISC-V, CPU microarchitecture, Verilog, Chisel, and Bluespec SystemVerilog. I explore how instructions and pipelines translate into hardware descriptions.
- **Systems programming and toolchains**: C/C++, Rust, kernel builds, and low-level debugging. I'm interested in how code behaves in real systems and the constraints that shape its implementation.

## Technical notes

[Nay's Blog](https://nyachen.cn/) is where I collect notes from reading source code, learning, and experimenting. I aim to trace a question from its observable behavior to the implementation: which paths it takes, which structures it relies on, and why it was designed that way.

These articles offer a starting point for the topics I study and write about. The articles are in Chinese.

- [How Linux Boots: From Power-On to the init Process](https://nyachen.cn/2026/07/22/linux-beginner-boot-overview/): following the handoff between hardware, the kernel, and userspace.
- [The Six Core Objects of VFS](https://nyachen.cn/2026/08/26/linux-modern-vfs-six-core-objects/): understanding Linux's shared filesystem abstractions through their object relationships.
- [Hardware Description Languages for RISC-V: Verilog, Chisel, and Bluespec SystemVerilog](https://nyachen.cn/2026/07/22/riscv-hardware-languages-overview/): an overview of different ways to describe hardware and how to approach learning them.

More writing is available in the [archive](https://nyachen.cn/archive/) and [topic series](https://nyachen.cn/series/).

## Open-source work

My contributions to the Linux kernel include:

- **OpenRISC**: adding support for the [text patching API](https://github.com/torvalds/linux/commit/4735037b5d9), [PC-relative relocations in kernel modules](https://github.com/torvalds/linux/commit/9d0cb6d00be), and [jump labels](https://github.com/torvalds/linux/commit/8c30b0018f9).
- **Rust for Linux / kbuild**: fixing [cleanup of libpin_init_internal by mrproper](https://github.com/torvalds/linux/commit/a44bfed9df8).

Commits, patch discussions, and other open-source activity are collected on my [contributions page](https://nyachen.cn/contribution/).

## Get in touch

If you read kernels, write drivers, or explore the boundary between software and hardware, I'd be glad to exchange ideas. Corrections and different perspectives on my articles are welcome too.

- **Email**: [chenmiao.ku@gmail.com](mailto:chenmiao.ku@gmail.com)
- **GitHub**: [@ChenMiaoi](https://github.com/ChenMiaoi)
- **Zhihu**: [My articles](https://www.zhihu.com/people/Pigeon/posts)

---

This repository contains my blog's source code. Development, writing, and deployment instructions are in the [maintenance guide](docs/development.md) (Chinese).
