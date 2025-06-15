---
title: 'GSOC2025: How To Start With OpenRISC'
mathjax: true
date: 2025-06-15 18:02:57
tags: [GSOC, OpenRISC]
categories: [GSOC]
---

# GSOC 2025: How To Start With OpenRISC

2025年5月9日的清晨，阳光透过窗帘洒在书桌上，我像往常一样打开邮箱，例行公事般地扫视着堆积如山的垃圾邮件和社区订阅信件（尽管这些内容我从未真正点开过^v^）。距离我提交GSOC提案已经过去整整一个月了，最初的几天里，我几乎每隔几分钟就会刷新一次收件箱，满心期待能收到回复；而如今，这份期待早已被时间冲淡，只剩下一种机械般的习惯，让我每天早晨仍会不自觉地检查邮箱。

正当我准备关掉页面，心想今天大概又是一无所获时，屏幕突然一闪——邮箱自动刷新，一封崭新的邮件赫然出现在最上方。

《**GSoC 2025: Congratulations, your proposal with Free and Open Source Silicon Foundation has been accepted**!》

![GSoC 2025: Congratulations](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615182136.png)

我知道，我的任务开始了——这不再是一个普通的周五早晨，而是我开源生涯真正的起点。

---

在提案通过的那天，我正式与导师Shorne展开合作。他给我的第一个任务是**搭建OpenRISC架构的编译工具链，并通过QEMU启动一个OpenRISC架构的Linux系统**。

起初，我花费了大量时间编写自己的构建脚本([OpenRISC-Build](https://github.com/ChenMiaoi/GSO2025-OpenRISC))，但后来才发现Shorne早已维护了一个成熟的工具库([or1k-util](https://github.com/stffrdhrn/or1k-utils))。由于走了弯路，两周过去，我仍未能成功启动OpenRISC Linux系统。

当Shorne询问进展时，我告诉他我的脚本卡在了启动阶段。他反问道：“为什么不直接用`or1k-util`？”这时我才意识到，自己又陷入了过度发散思维的陷阱，白白浪费了不少时间。

于是，我转而使用`or1k-util`，按照文档指引一步步配置，最终顺利运行起了OpenRISC Linux系统。

## Really Docs For How To Start

本章节是正式的对如何通过[or1k-util](https://github.com/stffrdhrn/or1k-utils)实现在本地通过QEMU运行起一个真正的OpenRISC架构的Linux内核，并且可以通过该内核进行调试的教程。

我当前使用的环境如下所示：

``` bash
Ubuntu 24.10

$ uname -a
Linux nyaos 6.11.0-26-generic #26-Ubuntu SMP PREEMPT_DYNAMIC Sat Apr 12 11:25:41 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux
```

由于OpenRISC架构的主线版本的glibc暂时有bug，因此我们暂时使用了指定版本的编译链版本：

``` bash
OR1K_GCC_URL="https://mirrors.aliyun.com/gnu/gcc/gcc-14.2.0/gcc-14.2.0.tar.gz"
OR1K_BINUTILS_GDB_URL="https://github.com/bminor/binutils-gdb.git"
OR1K_NEWLIB_URL="ftp://sourceware.org/pub/newlib/newlib-4.5.0.20241231.tar.gz"
```

在一切开始之前，我们需要确定**运行并调试一个OpenRISC架构的Linux内核到底需要什么？**

- QEMU OpenRISC
- rootfs
- or1k-linux-gcc
- or1k-elf-gdb
- linux OpenRISC

虽然在前面提到，我浪费了很多时间在自己的脚本上，但是由于`or1k-utils`本身并不会自动下载对应的源码/软件包，只会对指定目录下是否存在对应的源码/软件包进行检测。因此我们的下载工具使用`OpenRISC-Build`进行自动下载，后续的编译工作则是交给`or1k-utils`进行。

### DownLoad Source With OpenRISC-Build

首先，我们需要将脚本仓库克隆到一个任意位置：

``` bash
git clone https://github.com/ChenMiaoi/GSO2025-OpenRISC.git OpenRISC-Build
```

> **注意：`OpenRISC-Build`现只有下载源码的功能，一切的编译操作由`or1k-utils`来进行**。

当仓库克隆完毕后，我们就可以进入到仓库中，然后进行源码的下载。

``` bash
cd OpenRISC-Build
./build-or1k.sh --get-rootfs
./build-or1k.sh --get-tools

source ~/.bashrc

./build-or1k.sh --get-qemu
./build-or1k.sh --get-linux
./build-or1k.sh --get-or1k-utils
```

下表是关于脚本下载各种源码的命令，下载的内容以及各自源码存放的位置(根据`or1k-utils`所设置)

| **Command**    | **Work**                       | **Dir**                               |
|:---------------|:-------------------------------|:--------------------------------------|
| get rootfs     | download rootfs                | $HOME/work/openrisc/buildroot-rootfs  |
| get tools      | download or1k-linux-           | $HOME/work/gnu-toolchain/local        | 
|                | download gcc-14.2.0            | $HOME/work/gnu-toolchain/gcc          |
|                | download binutils-gdb          | $HOME/work/gnu-toolchain/binutils-gdb |
|                | download newlib-4.5.0.20241231 | $HOME/work/gnu-toolchain/newlib       |
| get qemu       | download qemu                  | $HOME/work/openrisc/qemu              | 
| get linux      | download linux                 | $HOME/work/linux                      |
| get or1k-utils | download or1k-utils            | $HOME/work/openrisc/or1k-utils        |

> 注意：**一切的源码均会下载到`$HOME/work/openrisc`、`$HOME/work/linux`以及`$HOME/work/toolchain`中**  
> 注意：**当使用`--get-tools`后，建议`source ~/.bashrc`一下**

下面是关于各自命令下载后的目录结构：

``` bash
$ tree -L 1 work/
work/
├── gnu-toolchain
├── linux
└── openrisc

$ tree -L 1 work/gnu-toolchain/
work/gnu-toolchain/
├── binutils
├── gcc
├── gdb
├── local
└── newlib

$ tree -L 1 work/openrisc/
work/openrisc/
├── buildroot-rootfs
├── or1k-utils
├── qemu
└── toolchain
```

当一切准备就绪后，我们就可以开始进行编译了。

### Build Source With Or1k-utils

虽然已经说过很多次了，但在这里还需要强调：**一切的编译步骤都是通过下载的`or1k-utils`进行**。

因此，我们进入`or1k-utils`目录中：

``` bash
cd or1k-utils
```

#### BUILD QEMU

首先，我们应该编译`QEMU`和`OR1K-ELF-`工具链：

``` bash
./qemu/config.qemu
./scripts/qemu-build
```

编译完成后，可以查看对应目录以及查看其对应的版本信息：

``` bash
ls $HOME/work/openrisc/qemu/build
qemu-or1k
qemu-system-or1k

$HOME/work/openrisc/qemu/build/qemu-system-or1k --version
QEMU emulator version 10.0.50
Copyright (c) 2003-2025 Fabrice Bellard and the QEMU Project developers
```

> 注意：**我们并不需要安装QEMU到一个指定路径，因为后续的使用均直接使用了编译目录的QEMU**。

#### BUILD OR1K-ELF

然后，我们开始编译`OR1K-ELF-`工具链：

``` bash
NOTIFY=n ./toolchains/newlib.build
```

这里我们传递了一个`NOTIFY`参数，这时因为在`newlib.build`中有一个[MAILTO](https://github.com/stffrdhrn/or1k-utils/blob/82f7c73cf60c79c282297e7ec4e43311f20b2118/toolchains/newlib.config#L56)参数，我并不需要发送邮件给自己或其他人，因此，这里使用`NOTIFY=n`禁止发送。

由于编译脚本会将所有的编译信息重定向到`$HOME/work/gnu-toolchain/log/${CROSS}-build.log`中，因此你可以使用下面的命令来实时监控：

``` bash
tail -f $HOME/work/gnu-toolchain/log/or1k-elf-build.log
```

编译完成后，我们可以查看指定目录：

``` bash
ls $HOME/work/gnu-toolchain/local/
bin  include  lib  libexec  or1k-elf  share

ls $HOME/work/gnu-toolchain/local/bin/
or1k-elf-addr2line  or1k-elf-c++      or1k-elf-elfedit  or1k-elf-gcc-14.2.0  or1k-elf-gcc-ranlib  or1k-elf-gcov-tool      or1k-elf-gprof   or1k-elf-ld.bfd   or1k-elf-objdump  or1k-elf-run      or1k-elf-strip
or1k-elf-ar         or1k-elf-c++filt  or1k-elf-g++      or1k-elf-gcc-ar      or1k-elf-gcov        or1k-elf-gdb            or1k-elf-gstack  or1k-elf-nm       or1k-elf-ranlib   or1k-elf-size
or1k-elf-as         or1k-elf-cpp      or1k-elf-gcc      or1k-elf-gcc-nm      or1k-elf-gcov-dump   or1k-elf-gdb-add-index  or1k-elf-ld      or1k-elf-objcopy  or1k-elf-readelf  or1k-elf-strings
```

我们着重需要注意的是两个东西：`or1k-elf-gcc`和`or1k-elf-gdb`：

``` bash
$HOME/work/gnu-toolchain/local/bin/or1k-elf-gcc -v
Using built-in specs.
COLLECT_GCC=/home/nya/work/gnu-toolchain/local/bin/or1k-elf-gcc
COLLECT_LTO_WRAPPER=/home/nya/work/gnu-toolchain/local/libexec/gcc/or1k-elf/14.2.0/lto-wrapper
Target: or1k-elf
Configured with: /home/nya/work/gnu-toolchain/gcc/configure --target=or1k-elf --prefix=/home/nya/work/gnu-toolchain/local --with-gnu-ld --with-gnu-as --disable-nls --disable-lto --disable-libssp --disable-shared --with-multilib-list=mcmov --enable-languages=c,c++ --with-newlib
Thread model: single
Supported LTO compression algorithms: zlib
gcc version 14.2.0 (GCC) 

$HOME/work/gnu-toolchain/local/bin/or1k-elf-gdb -v
GNU gdb (GDB) 17.0.50.20250605-git
Copyright (C) 2024 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
```

#### BUILD LINUX

当前面的所有准备就绪后，我们就可以编译OpenRISC架构的Linux内核了。

``` bash
./scripts/make-or1k-linux virt_defconfig
```

> Shorne曾问过我: "did you compile the kernel with debug symbols?"  
> 当时我以为我会，事实上，我并不会。因此，Shorne手把手带我编译了一遍，感谢Shorne

接下来我们需要编译一个带调试信息的内核，因此我们使用`menuconfig`进行配置。

``` bash
./scripts/make-or1k-linux menuconfig
```

![or1k menuconfig](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615202715.png)

如上图所示，当你执行`menuconfig`后会进入如下的TUI界面，我们需要通过这样的路径：

``` txt
Kernel hacking  --->
    Kernel debugging  ---> y
    
Kernel hacking  --->
    Compile-time checks and compiler options  --->
        Debug information (Disable debug information)  --->
            Rely on the toolchain's implicit default DWARF version  ---> y
        Provide GDB scripts for kernel debugging  ---> y
```

![menuconfig debug info](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615202956.png)

通过上面的设置，我们就将三个关键选项设置好了：

- Kernel debugging
- Rely on the toolchain's implicit default DWARF version
- Provide GDB scripts for kernel debugging

然后我们就可以开始编译内核：

``` bash
./scripts/make-or1k-linux
```

如果一切没有报错，我们就可以检查内核目录下是否存在`vmlinux`文件：

``` bash
ls $HOME/work/linux/
vmlinux

file $HOME/work/linux/vmlinux
/home/nya/work/linux/vmlinux: ELF 32-bit MSB executable, OpenRISC, version 1 (SYSV), statically linked, BuildID[sha1]=bab6c2d0b0a5111785bda2c9268c7a3871e3dc6e, with debug_info, not stripped
```

至此，所有的编译工作就完成了。

### Starting And Debugging 

在启动内核之前，我们需要了解启动脚本的一些参数。

> Shorne又一次拷打我："do you know what commands to run? For example, how to start qemu in debug mode?" 

在`or1k-utils`中，启动内核所使用的脚本为`qemu-or1k-linux`，其中有一个`-S`参数与QEMU的调试相关：

``` txt
# Debug, add -S to stop on startup
DEBUG="-gdb tcp::10001"
```

> 我当时回答Shorne："add the -S, using the qemu-linux -S"  

显而易见的，这是截然相反的。如果我们想要调试内核，就不应该加上`-S`参数，这个脚本默认启动了调试端口。因此，对于调试，我们可以直接运行脚本(当然，直接启动也是可以的)。

``` bash
./scripts/qemu-or1k-linux
[    0.000000] FDT at (ptrval)
[    0.000000] random: crng init done
[    0.000000] Linux version 6.15.0-dirty (nya@nyaos) (or1k-linux-gcc (GCC) 14.2.0, GNU ld (GNU Binutils) 2.43.1) #2 SMP Fri Jun 13 16:02:54 UTC 2025
[    0.000000] OF: reserved mem: Reserved memory: No reserved-memory node in the DT
[    0.000000] CPU: OpenRISC-13 (revision 8) @20 MHz
[    0.000000] -- dmmu:  128 entries, 1 way(s)
[    0.000000] -- immu:  128 entries, 1 way(s)
[    0.000000] -- additional features:
[    0.000000] -- power management
[    0.000000] -- PIC
[    0.000000] -- timer
[    0.000000] Initial ramdisk not found
......
[    0.360000] EXT4-fs (vda2): INFO: recovery required on readonly filesystem
[    0.360000] EXT4-fs (vda2): write access will be enabled during recovery
[    1.590000] EXT4-fs (vda2): orphan cleanup on readonly fs
[    1.590000] EXT4-fs (vda2): recovery complete
[    1.600000] EXT4-fs (vda2): mounted filesystem d4e1e6f8-942f-4d45-9afe-4e73dcfff064 ro with ordered data mode. Quota mode: disabled.
[    1.600000] VFS: Mounted root (ext4 filesystem) readonly on device 254:2.
[    1.600000] devtmpfs: mounted
[    1.640000] Freeing unused kernel image (initmem) memory: 264K
[    1.640000] This architecture does not have kernel memory protection.
[    1.640000] Run /sbin/init as init process
INIT: version 3.13 booting
INIT: No inittab.d directory found
[    1.800000] EXT4-fs (vda2): re-mounted d4e1e6f8-942f-4d45-9afe-4e73dcfff064 r/w.
[    1.920000] Adding 2097144k swap on /dev/vda1.  Priority:-2 extents:1 across:2097144k 
INIT: Entering runlevel: 3
Seeding 256 bits without crediting
Saving 256 bits of creditable seed for next boot
Starting syslogd: OK
Starting klogd: OK
Running sysctl: OK
Starting network: OK
Starting sntp: sntp 4.2.8p18@1.4062-o Wed Apr 16 22:01:36 UTC 2025 (1)
libgcc_s.so.1 must be installed for pthread_exit to work
/etc/init.d/S48sntp: line 15:   124 Aborted                 /usr/bin/$DAEMON $SNTP_ARGS -K $SNTP_KEY_CACHE $SNTP_SERVERS
FAIL
Starting crond: OK
Starting sshd: OK

Welcome to Linux on OpenRISC
buildroot login: 
```

默认的用户为`root`，并且没有密码，因此我们键入`root`敲击回车后，即可直接进入系统。

``` bash
Welcome to Linux on OpenRISC
buildroot login: root
  _      __    __
 | | /| / /__ / /______  __ _  ___
 | |/ |/ / -_) / __/ _ \/  ' \/ -_)
 |__/|__/\__/_/\__/\___/_/_/_/\__/
                   / /____
                  / __/ _ \
  ____     _____  \__/\___/________  ______
 / __ \___<  / /_____| | / /  _/ _ \/_  __/
/ /_/ / __/ /  '_/___/ |/ // // , _/ / /
\____/_/ /_/_/\_\    |___/___/_/|_| /_/

 32-bit OpenRISC CPUs on a QEMU Virt Platform
# uname -a
Linux buildroot 6.15.0-dirty #2 SMP Fri Jun 13 16:02:54 UTC 2025 openrisc GNU/Linux
```

如果我们想要调试内核，则通过编译好的`or1k-elf-gdb`进行调试。

> 注意：**远程调试端口号为10001**  

``` bash
or1k-elf-gdb vmlinux
(gdb) target remote :10001
Remote debugging using :10001
```

![qemu debug](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615204830.png)
