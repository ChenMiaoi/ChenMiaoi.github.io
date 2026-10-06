---
title: Linux 文件系统
description: 以 RISC-V QEMU 实验系统为载体，从文件描述符和 VFS 出发，理解 inode、dentry、page cache、挂载与具体文件系统。
image: ''
translations:
  en:
    title: "Linux File Systems"
    description: "Starting with file descriptors and VFS on a RISC-V QEMU system, explore inode, dentry, page cache, mounts and concrete file systems."
  zh_TW:
    title: "Linux 檔案系統"
    description: "以 RISC-V QEMU 實驗系統為載體，從檔案描述符和 VFS 出發，理解 inode、dentry、page cache、掛載與具體檔案系統。"
  ja:
    title: "Linux のファイルシステム"
    description: "RISC-V QEMU 上のファイルディスクリプタと VFS を出発点に、inode、dentry、ページキャッシュ、マウント、個々のファイルシステムを学びます。"
---

本专辑下设 [Linux 现代 VFS 解读子专栏](/series/linux-modern-vfs/)，从 open、read、write、rename 和 mount 等真实路径出发，理解 VFS 如何连接用户空间系统调用与具体文件系统；另有 [EROFS 源码解析子专辑](/series/linux-erofs/)，从只读镜像的设计目标开始，继续分析 superblock、inode、目录项、数据映射和透明压缩。
