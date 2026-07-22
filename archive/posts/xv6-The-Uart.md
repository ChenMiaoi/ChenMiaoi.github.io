---
title: 'xv6: The Uart'
slug: xv6-The-Uart
published: 2024-06-27
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
---
上一节中，我们介绍了`xv6`中的自旋锁。在这一节，我们将从`uart`开始介绍，`uart`是`xv6`中`console`和`printf`的最基础的模块，用于串口通信。而对于`xv6-riscv`的`uart`模块的构成则是参考了[16550a-uart](http://byterunner.com/16550.html)或[16550a-uart SIDSA](https://caro.su/msx/ocm_de1/16550.pdf)。

![Uart](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406271027143.png)

## Uart

