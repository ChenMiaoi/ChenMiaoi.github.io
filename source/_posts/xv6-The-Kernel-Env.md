---
title: 'xv6: The Kernel Env'
mathjax: true
date: 2024-05-17 15:44:54
tags: [xv6, os, risc-v]
categories: [xv6]
---

# XV6 Operator System: 03-The Kernel Environment

在上一节中，我详细介绍了`xv6-riscv`的`start`函数，里面对`xv6-riscv`的内核执行特权级环境、中断环境和定时器中断进行了一系列配置。现在，让我们来看看`xv6-riscv`内核态中的具体配置和实现。

## Main Function

在本节中，我们只会对内核态的配置做出大概介绍，具体的介绍在后续会为每一个模块做出详细章节来讲述。

我们从`xv6-riscv`的源码中也可以看出`main`函数主要是对各种模块进行启用，然后调用`initcode`进入到用户态中，完成整个操作系统的启动。

需要完全的理解该代码，我们需要进行一些知识的准备。

### volatile type

**Every access (both read and write) made through a lvalue expression of volatile-qualified type is considered an observable side effect for the purpose of optimization and is evaluated strictly according to the rules of the abstract machine (that is, all writes are completed at some time before the next sequence point). This means that within a single thread of execution, a volatile access cannot be optimized out or reordered relative to another visible side effect that is separated by a sequence point from the volatile access**.

使用`volatile`限定类型的左值表达式的每次访问(无论是读取还是写入)都被视为一个可观察的副作用，并且严格按照抽象机器的规则进行评估(也就是说，所有写操作都会在下一个序列点之前完成)。**这意味着在单个线程的执行过程中，一个**`volatile`**访问不能被优化掉，也不能相对于另一个由序列点分隔的可见副作用进行重新排序**。

通常，编译器会优化代码以提高执行效率。例如，如果一个变量在代码中没有被显式修改，编译器可能会将其值缓存到寄存器中，以避免多次访问内存。然而，对于某些变量(如硬件寄存器、共享内存、信号处理程序中的变量等)，它们的值可能在程序之外被修改。如果编译器对这些变量进行优化，可能会导致程序读取的值不是最新的，从而引发错误。`volatile`**关键字通知编译器不要对这些变量进行优化，每次都应从内存中读取它们的最新值**。

在多线程环境中，多个线程可能会访问和修改同一个变量。使用`volatile`可以**确保一个线程对该变量所做的修改能立即被其他线程看到**。

值得注意的：`volatile`**仅保证了变量的最新值读取，不提供任何同步机制。如果多个线程同时读写同一个变量，还需要使用适当的同步机制(如互斥锁)来确保操作的原子性和一致性**。

在某些体系结构和编译器实现中，即使使用了`volatile`，依然可能需要额外的内存屏障(`memory barrier`)指令来确保正确的内存访问顺序。

### __sync_synchronize

`__sync_synchronize`是`GCC`提供的一种内存屏障(`memory barrier`或`memory fence`)，**用于确保在多处理器系统上进行的内存操作按照程序指定的顺序执行。它在涉及多线程编程时尤其有用，能够防止编译器和CPU对内存操作进行不正确的重排序**。

- 防止重排
  - `__sync_synchronize`用于阻止编译器和`CPU`对内存操作进行重排序。**这样可以确保在它之前的内存操作在它之后的内存操作之前完成**。这对于多线程程序中的同步非常重要，能确保不同线程对共享数据的访问顺序正确
- 确保内存可见性
  - **在调用该函数之前进行的所有内存写操作在其他处理器和线程中变得可见**。因此，它可以用于实现内存可见性保证，确保一个线程所做的更改对其他线程可见

```c 
#include <stdio.h>
#include <pthread.h>

volatile int flag = 0;
int data = 0;

void *thread1_func(void *arg) {
    data = 42;             // 写入数据
    __sync_synchronize();  // 内存屏障，确保写操作完成
    flag = 1;              // 设置标志，通知另一个线程
    return NULL;
}

void *thread2_func(void *arg) {
    while (flag == 0);     // 等待标志
    __sync_synchronize();  // 内存屏障，确保读取最新的data
    printf("Data: %d\n", data);  // 输出data
    return NULL;
}

int main() {
    pthread_t thread1, thread2;
    pthread_create(&thread1, NULL, thread1_func, NULL);
    pthread_create(&thread2, NULL, thread2_func, NULL);

    pthread_join(thread1, NULL);
    pthread_join(thread2, NULL);

    return 0;
}
```

线程1在写入`data`后调用`__sync_synchronize`来确保在设置`flag`之前，`data`的写操作已经完成并且对其他线程可见。线程2在读取到`flag`为`1`后调用`__sync_synchronize`来确保在读取`data`之前，所有之前的内存操作(包括线程1对`data`的写操作)都已经完成并且对当前线程可见。

这样就使得，不论如何，线程2所看见的`data`的数据总是线程1已经写入完毕后的`data`数据，而不会发生线程1正在写的时候(并未写入)，线程2访问`data`得到了一个错误的数据。

### Main Code

在了解上面的前置知识后，我们就可以逐行解析`xv6-riscv`内核的大致流程了:

```c
volatile static int started = 0;

// start() jumps here in supervisor mode on all CPUs.
void main() {
    if (cpuid() == 0) {
        consoleinit();
        printfinit();
        printf("\n");
        printf("xv6 kernel is booting\n");
        printf("\n");
        kinit();            // physical page allocator
        kvminit();          // create kernel page table
        kvminithart();      // turn on paging
        procinit();         // process table
        trapinit();         // trap vectors
        trapinithart();     // install kernel trap vector
        plicinit();         // set up interrupt controller
        plicinithart();     // ask PLIC for device interrupts
        binit();            // buffer cache
        iinit();            // inode table
        fileinit();         // file table
        virtio_disk_init(); // emulated hard disk
        userinit();         // first user process
        __sync_synchronize();
        started = 1;
    } else {
        while (started == 0)
            ;
        __sync_synchronize();
        printf("hart %d starting\n", cpuid());
        kvminithart();  // turn on paging
        trapinithart(); // install kernel trap vector
        plicinithart(); // ask PLIC for device interrupts
    }
    
    scheduler();
}
```

`volatile static int started = 0`：定义一个静态变量`started`，用来协调各个`hart`的启动。`volatile`关键字确保每次访问该变量时，都从内存中读取最新的值，而不是从寄存器中读取缓存值。

在`xv6-riscv`中，我们将$hartid = 0$的`hart`标识为主要的执行流，主`hart`执行一系列初始化函数，如`consoleinit()`、`kinit()`、`kvminit()`等，这些函数负责**初始化控制台**、**物理内存分配器**、**内核页表**、**进程表**、**trap vector**、**中断控制器**、**缓存**、**inode表**、**文件表**和**虚拟磁盘**等。

而`__sync_synchronize()`在`started`变量赋值之前调用内存屏障，确保所有的初始化操作都在赋值之前完成。这样就使得其他`hart`流执行时，访问到的`started`数据一定是$started == 1$的。

其他的`hart`流执行需要等待主要`hart`流执行完毕，直到$started == 1$为止，`__sync_synchronize()`使得`hart`流能够看见主要`hart`执行流的一切初始化操作，然后`hart`执行自己的初始化函数，如`kvminithart()`、`trapinithart()`和`plicinithart()`，这些函数负责启用分页、安装内核陷阱向量、请求设备中断等。

最终，所有`hart`(包括主`hart`和从`hart`)都进入调度器，以开始调度和执行任务。值得注意的是，第一个任务是**跳转到用户态执行**`initcode`。

这里给出对应的部分逻辑(在此不做过多介绍)：

```c
uchar initcode[] = {
  0x17, 0x05, 0x00, 0x00, 0x13, 0x05, 0x45, 0x02,
  ...
};

uvmfirst(p->pagetable, initcode, sizeof(initcode));
p->trapframe->epc = 0;     // user program counter
p->state = RUNNABLE;

# exec(init, argv)
.globl start
start:
        la a0, init
        la a1, argv
        li a7, SYS_exec
        ecall
```

可以看见，`userinit`会在内部调用`uvmfirst`函数来设置第一个任务为`initcode`，然后通过`scheduler`函数跳转到`initcode.S`中执行。而`initcode`中通过`exec`程序调用了用户态的`init`程序，`init`程序又会调用`sh`执行`shell`环境，然后就正式进入了用户态，并且终端上呈现出:

```bash
init: starting sh
#  
```

