---
slug: GSOC2025-How-To-Start-With-OpenRISC.en
title: 'GSOC2025: How To Start With OpenRISC'
published: 2025-06-15
tags:
  - GSOC
  - OpenRISC
category: GSOC
series: gsoc2025
lang: "en"
---
On the early morning of May 9, 2025, sunlight filtered through the curtains onto my desk. As usual, I opened my mailbox and routinely scanned the mountain of spam and community subscription emails (though I never actually clicked into any of them ^v^). A full month had passed since I submitted my GSoC proposal. In the first few days, I refreshed my inbox almost every few minutes, eagerly awaiting a reply; but by now, that anticipation had long since faded with time, leaving only a mechanical habit that made me check my email every morning without even thinking about it.

Just as I was about to close the page, thinking today would be another fruitless day, the screen suddenly flashed — the mailbox auto-refreshed, and a brand-new email appeared right at the top.

**"GSoC 2025: Congratulations, your proposal with Free and Open Source Silicon Foundation has been accepted"!**

![GSoC 2025: Congratulations](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615182136.png)

I knew my task had begun — this was no longer an ordinary Friday morning, but the true starting point of my open-source career.

---

On the day my proposal was accepted, I officially began working with my mentor, Shorne. The first task he gave me was to **set up a compilation toolchain for the OpenRISC architecture and boot an OpenRISC-architecture Linux system through QEMU**.

At first, I spent a lot of time writing my own build scripts ([OpenRISC-Build](https://github.com/ChenMiaoi/GSO2025-OpenRISC)), only to discover later that Shorne had long been maintaining a mature utility collection ([or1k-util](https://github.com/stffrdhrn/or1k-utils)). Because of this detour, two weeks passed and I still hadn't successfully booted the OpenRISC Linux system.

When Shorne asked about my progress, I told him my script was stuck at the booting stage. He asked in return: "Why not just use `or1k-util`?" Only then did I realize that I had fallen into the trap of overthinking once again and wasted quite a lot of time for nothing.

So I switched to `or1k-util`, followed the documentation step by step, and finally got the OpenRISC Linux system up and running.

## Really Docs For How To Start

This chapter is the formal tutorial on how to use [or1k-util](https://github.com/stffrdhrn/or1k-utils) to run a real OpenRISC-architecture Linux kernel locally through QEMU, and how to debug with that kernel.

My current environment is as follows:

```bash
Ubuntu 24.10

$ uname -a
Linux nyaos 6.11.0-26-generic #26-Ubuntu SMP PREEMPT_DYNAMIC Sat Apr 12 11:25:41 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux
```

Since the mainline version of glibc for the OpenRISC architecture currently has a bug, we temporarily use specific toolchain versions:

```bash
OR1K_GCC_URL="https://mirrors.aliyun.com/gnu/gcc/gcc-14.2.0/gcc-14.2.0.tar.gz"
OR1K_BINUTILS_GDB_URL="https://github.com/bminor/binutils-gdb.git"
OR1K_NEWLIB_URL="ftp://sourceware.org/pub/newlib/newlib-4.5.0.20241231.tar.gz"
```

Before everything begins, we need to figure out **what exactly is needed to run and debug an OpenRISC-architecture Linux kernel?**

- QEMU OpenRISC
- rootfs
- or1k-linux-gcc
- or1k-elf-gdb
- linux OpenRISC

Although I mentioned earlier that I wasted a lot of time on my own scripts, `or1k-utils` itself does not automatically download the corresponding source code/packages; it only checks whether the corresponding source code/packages exist in the specified directories. Therefore, we use `OpenRISC-Build` as our download tool for automatic downloading, while the subsequent compilation work is handed over to `or1k-utils`.

### DownLoad Source With OpenRISC-Build

First, we need to clone the script repository to any location:

```bash
git clone https://github.com/ChenMiaoi/GSO2025-OpenRISC.git OpenRISC-Build
```

> **Note: `OpenRISC-Build` currently only provides source-code downloading; all compilation operations are performed by `or1k-utils`**.

Once the repository is cloned, we can enter it and download the source code.

```bash
cd OpenRISC-Build
./build-or1k.sh --get-rootfs
./build-or1k.sh --get-tools

source ~/.bashrc

./build-or1k.sh --get-qemu
./build-or1k.sh --get-linux
./build-or1k.sh --get-or1k-utils
```

The table below lists the script commands for downloading each kind of source code, what gets downloaded, and where each source tree is stored (as configured by `or1k-utils`)

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

> Note: **All source code will be downloaded into `$HOME/work/openrisc`, `$HOME/work/linux`, and `$HOME/work/toolchain`**  
> Note: **After using `--get-tools`, it is recommended to run `source ~/.bashrc`**

Below is the directory structure after the downloads from each command:

```bash
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

When everything is ready, we can start compiling.

### Build Source With Or1k-utils

Although it has been said many times, it still needs to be emphasized here: **all compilation steps are performed through the downloaded `or1k-utils`**.

Therefore, we enter the `or1k-utils` directory:

```bash
cd or1k-utils
```

#### BUILD QEMU

First, we should compile `QEMU` and the `OR1K-ELF-` toolchain:

```bash
./qemu/config.qemu
./scripts/qemu-build
```

After the compilation completes, you can check the corresponding directory and its version information:

```bash
ls $HOME/work/openrisc/qemu/build
qemu-or1k
qemu-system-or1k

$HOME/work/openrisc/qemu/build/qemu-system-or1k --version
QEMU emulator version 10.0.50
Copyright (c) 2003-2025 Fabrice Bellard and the QEMU Project developers
```

> Note: **We do not need to install QEMU to a specific path, because all subsequent usage directly uses the QEMU in the build directory**.

#### BUILD OR1K-ELF

Then, we start compiling the `OR1K-ELF-` toolchain:

```bash
NOTIFY=n ./toolchains/newlib.build
```

Here we pass a `NOTIFY` parameter. This is because there is a [MAILTO](https://github.com/stffrdhrn/or1k-utils/blob/82f7c73cf60c79c282297e7ec4e43311f20b2118/toolchains/newlib.config#L56) parameter in `newlib.build`, and I don't need to send emails to myself or anyone else, so we use `NOTIFY=n` to disable sending.

Since the build script redirects all compilation output to `$HOME/work/gnu-toolchain/log/${CROSS}-build.log`, you can use the following command to monitor it in real time:

```bash
tail -f $HOME/work/gnu-toolchain/log/or1k-elf-build.log
```

After the compilation completes, we can check the specified directory:

```bash
ls $HOME/work/gnu-toolchain/local/
bin  include  lib  libexec  or1k-elf  share

ls $HOME/work/gnu-toolchain/local/bin/
or1k-elf-addr2line  or1k-elf-c++      or1k-elf-elfedit  or1k-elf-gcc-14.2.0  or1k-elf-gcc-ranlib  or1k-elf-gcov-tool      or1k-elf-gprof   or1k-elf-ld.bfd   or1k-elf-objdump  or1k-elf-run      or1k-elf-strip
or1k-elf-ar         or1k-elf-c++filt  or1k-elf-g++      or1k-elf-gcc-ar      or1k-elf-gcov        or1k-elf-gdb            or1k-elf-gstack  or1k-elf-nm       or1k-elf-ranlib   or1k-elf-size
or1k-elf-as         or1k-elf-cpp      or1k-elf-gcc      or1k-elf-gcc-nm      or1k-elf-gcov-dump   or1k-elf-gdb-add-index  or1k-elf-ld      or1k-elf-objcopy  or1k-elf-readelf  or1k-elf-strings
```

The two things we need to pay close attention to are `or1k-elf-gcc` and `or1k-elf-gdb`:

```bash
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

After all the previous preparations are in place, we can compile the OpenRISC-architecture Linux kernel.

```bash
./scripts/make-or1k-linux virt_defconfig
```

> Shorne once asked me: "did you compile the kernel with debug symbols?"  
> At the time I thought I knew how, but in fact, I did not. So Shorne walked me through the compilation hands-on — thank you, Shorne.

Next, we need to compile a kernel with debug information, so we use `menuconfig` for configuration.

```bash
./scripts/make-or1k-linux menuconfig
```

![or1k menuconfig](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615202715.png)

As shown in the figure above, after running `menuconfig` you will enter the following TUI interface. We need to follow this path:

```txt
Kernel hacking  --->
    Kernel debugging  ---> y
    
Kernel hacking  --->
    Compile-time checks and compiler options  --->
        Debug information (Disable debug information)  --->
            Rely on the toolchain's implicit default DWARF version  ---> y
        Provide GDB scripts for kernel debugging  ---> y
```

![menuconfig debug info](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615202956.png)

With the above settings, we have configured the three key options:

- Kernel debugging
- Rely on the toolchain's implicit default DWARF version
- Provide GDB scripts for kernel debugging

Then we can start compiling the kernel:

```bash
./scripts/make-or1k-linux
```

If there are no errors, we can check whether the `vmlinux` file exists in the kernel directory:

```bash
ls $HOME/work/linux/
vmlinux

file $HOME/work/linux/vmlinux
/home/nya/work/linux/vmlinux: ELF 32-bit MSB executable, OpenRISC, version 1 (SYSV), statically linked, BuildID[sha1]=bab6c2d0b0a5111785bda2c9268c7a3871e3dc6e, with debug_info, not stripped
```

At this point, all the compilation work is complete.

### Starting And Debugging 

Before starting the kernel, we need to understand some parameters of the startup script.

> Shorne grilled me once again: "do you know what commands to run? For example, how to start qemu in debug mode?" 

In `or1k-utils`, the script used to start the kernel is `qemu-or1k-linux`, which has a `-S` parameter related to QEMU debugging:

```txt
# Debug, add -S to stop on startup
DEBUG="-gdb tcp::10001"
```

> My answer to Shorne at the time was: "add the -S, using the qemu-linux -S"  

Obviously, this is exactly the opposite. If we want to debug the kernel, we should not add the `-S` parameter; this script already enables the debug port by default. Therefore, for debugging, we can simply run the script directly (of course, simply booting it this way is fine too).

```bash
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

The default user is `root` with no password, so we type `root`, press Enter, and enter the system directly.

```bash
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

If we want to debug the kernel, we use the compiled `or1k-elf-gdb` to debug it.

> Note: **The remote debugging port number is 10001**  

```bash
or1k-elf-gdb vmlinux
(gdb) target remote :10001
Remote debugging using :10001
```

![qemu debug](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250615204830.png)