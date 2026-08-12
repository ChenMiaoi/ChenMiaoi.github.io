---
title: Linux EROFS 源码解析
description: 不背字段，沿着“不可变镜像为什么这样设计”这条主线，从一次 mount 和一次 read 读懂 EROFS 的架构、数据布局、压缩索引与内核实现。
image: ''
parent: linux-filesystems
order: 1
---

EROFS 是 Linux 内核中面向不可变镜像的只读文件系统。本专辑从“为什么需要一种可以直接挂载的压缩镜像”出发，逐步分析它的 on-disk layout、Super Block、inode 元数据、目录项、inline/shared xattr、data inline，以及不同的 inode 数据布局。

文章会沿着一次 `mount` 和一次文件读取展开：先理解镜像如何被内核识别，再追踪路径查找如何从目录项得到 NID，最后理解 inode 如何定位普通数据、内联数据和压缩数据。EROFS 的透明压缩是本专辑的核心重点，后续文章将进一步讲解压缩索引、logical cluster、physical cluster、随机读取、解压缓存以及压缩数据去重。
