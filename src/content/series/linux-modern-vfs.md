---
title: Linux 现代 VFS 解读
description: 沿着 open、read、write、rename 和 mount 等真实路径，理解现代 Linux VFS 如何组织 file、dentry、inode、super_block、address_space 与具体文件系统。
image: ''
parent: linux-filesystems
order: 2
translations:
  en:
    title: "Understanding Modern Linux VFS"
    description: "Follow open, read, write, rename and mount to understand file, dentry, inode, super_block, address_space and the file systems behind modern Linux VFS."
  zh_TW:
    title: "Linux 現代 VFS 解讀"
    description: "沿著 open、read、write、rename 和 mount 等實際路徑，理解現代 Linux VFS 如何組織 file、dentry、inode、super_block、address_space 與具體檔案系統。"
  ja:
    title: "現代の Linux VFS を読み解く"
    description: "open、read、write、rename、mount をたどり、現代の Linux VFS が file、dentry、inode、super_block、address_space とファイルシステムを結ぶ仕組みを学びます。"
---

本专栏聚焦 Linux 文件系统进入具体文件系统实现之前的那一层：VFS。内容会从用户空间系统调用出发，追踪路径查找、文件描述符、文件对象、目录项缓存、inode、挂载树与页缓存之间的关系，再连接到 ext4、EROFS 等具体文件系统的实现。

重点不是罗列结构体字段，而是围绕一次真实操作回答“请求如何流过内核”：一次 `openat` 如何完成路径解析，一次 `read` 如何经过 `file_operations` 和 `address_space`，一次 `rename` 如何处理目录项与锁，以及 mount namespace 如何改变进程看到的文件系统树。
