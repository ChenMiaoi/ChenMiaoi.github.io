---
slug: xv6-The-Uart.en
title: 'xv6: The Uart'
published: 2024-06-27
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
lang: "en"
---
In the previous section, we introduced the spinlock in `xv6`. In this section, we will start with the `uart`, the most fundamental module behind `console` and `printf` in `xv6`, which is used for serial communication. The `uart` module in `xv6-riscv` is modeled after the [16550a-uart](http://byterunner.com/16550.html) or the [16550a-uart SIDSA](https://caro.su/msx/ocm_de1/16550.pdf).

![Uart](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406271027143.png)

## Uart
