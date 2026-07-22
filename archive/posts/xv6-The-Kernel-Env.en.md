---
slug: xv6-The-Kernel-Env.en
title: 'xv6: The Kernel Env'
published: 2024-05-17
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
lang: "en"
---
In the previous section, I described the `start` function of `xv6-riscv` in detail, which performs a series of configurations for the kernel's execution privilege-level environment, interrupt environment, and timer interrupts. Now, let's take a look at the concrete configuration and implementation in the kernel mode of `xv6-riscv`.

## Main Function

In this section, we will only give a rough overview of the kernel-mode setup; each module will be covered in detail in dedicated chapters later on.

From the `xv6-riscv` source code, we can also see that the `main` function mainly enables the various modules and then calls `initcode` to enter user mode, completing the boot of the entire operating system.

To fully understand this code, we need to prepare some background knowledge first.

### volatile type

**Every access (both read and write) made through a lvalue expression of volatile-qualified type is considered an observable side effect for the purpose of optimization and is evaluated strictly according to the rules of the abstract machine (that is, all writes are completed at some time before the next sequence point). This means that within a single thread of execution, a volatile access cannot be optimized out or reordered relative to another visible side effect that is separated by a sequence point from the volatile access**.

Every access (whether a read or a write) made through an lvalue expression of `volatile`-qualified type is treated as an observable side effect and is evaluated strictly according to the rules of the abstract machine (that is, all writes complete before the next sequence point). **This means that within the execution of a single thread, a** `volatile` **access cannot be optimized away, nor can it be reordered relative to another visible side effect that is separated from the** `volatile` **access by a sequence point**.

Normally, the compiler optimizes code to improve execution efficiency. For example, if a variable is not explicitly modified in the code, the compiler may cache its value in a register to avoid accessing memory multiple times. However, for certain variables (such as hardware registers, shared memory, variables in signal handlers, and so on), their values may be modified outside the program. If the compiler optimized these variables, the program might read a value that is not up to date, leading to errors. The `volatile` **keyword tells the compiler not to optimize these variables, and that their latest values should be read from memory every time**.

In a multithreaded environment, multiple threads may access and modify the same variable. Using `volatile` **ensures that a modification made by one thread to the variable is immediately visible to the other threads**.

It's worth noting: `volatile` **only guarantees reading the latest value of a variable; it does not provide any synchronization mechanism. If multiple threads read and write the same variable at the same time, you still need appropriate synchronization mechanisms (such as mutexes) to ensure the atomicity and consistency of the operations**.

On some architectures and compiler implementations, even when `volatile` is used, additional memory barrier instructions may still be required to ensure the correct memory access order.

### __sync_synchronize

`__sync_synchronize` is a memory barrier (`memory barrier` or `memory fence`) provided by `GCC`. **It is used to ensure that memory operations performed on multiprocessor systems are executed in the order specified by the program. It is especially useful in multithreaded programming, as it prevents the compiler and the CPU from incorrectly reordering memory operations**.

- Preventing reordering
  - `__sync_synchronize` is used to stop the compiler and the `CPU` from reordering memory operations. **This ensures that the memory operations before it complete before the memory operations after it**. This is very important for synchronization in multithreaded programs, as it guarantees that different threads access shared data in the correct order
- Ensuring memory visibility
  - **All memory writes made before calling this function become visible to other processors and threads**. Therefore, it can be used to provide memory visibility guarantees, ensuring that changes made by one thread are visible to other threads

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

Thread 1 calls `__sync_synchronize` after writing `data`, to ensure that the write to `data` has completed and is visible to other threads before `flag` is set. After reading `flag` as `1`, thread 2 calls `__sync_synchronize` to ensure that before reading `data`, all previous memory operations (including thread 1's write to `data`) have completed and are visible to the current thread.

This way, no matter what, the `data` seen by thread 2 is always the `data` that thread 1 has finished writing, and it will never happen that thread 2 reads an incorrect value from `data` while thread 1 is in the middle of writing (but has not yet written) it.

### Main Code

Now that we understand the prerequisites above, we can walk through the general flow of the `xv6-riscv` kernel line by line:

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

`volatile static int started = 0`: defines a static variable `started`, used to coordinate the startup of the various `hart`s. The `volatile` keyword ensures that every access to this variable reads the latest value from memory, rather than a cached value from a register.

In `xv6-riscv`, the `hart` with $hartid = 0$ is designated as the main execution flow. The main `hart` executes a series of initialization functions, such as `consoleinit()`, `kinit()`, `kvminit()`, and so on, which are responsible for initializing the **console**, **physical memory allocator**, **kernel page table**, **process table**, **trap vector**, **interrupt controller**, **buffer cache**, **inode table**, **file table**, and **virtual disk**, among others.

And `__sync_synchronize()` places a memory barrier before the `started` variable is assigned, ensuring that all initialization operations complete before the assignment. This guarantees that when the other `hart` flows execute, the `started` value they access is always $started == 1$.

The other `hart` flows must wait for the main `hart` flow to finish executing, until $started == 1$. `__sync_synchronize()` allows a `hart` flow to see all the initialization operations performed by the main `hart` flow, and then the `hart` executes its own initialization functions, such as `kvminithart()`, `trapinithart()`, and `plicinithart()`, which are responsible for enabling paging, installing the kernel trap vector, and requesting device interrupts.

Finally, all `hart`s (including the main `hart` and the secondary `hart`s) enter the scheduler to begin scheduling and executing tasks. It's worth noting that the first task is to **jump to user mode to execute** `initcode`.

Here is the corresponding part of the logic (we won't go into detail here):

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

As you can see, `userinit` internally calls the `uvmfirst` function to set up the first task as `initcode`, and then jumps into `initcode.S` for execution through the `scheduler` function. Inside `initcode`, the user-mode `init` program is invoked via the `exec` program; the `init` program in turn invokes `sh` to run the `shell` environment, and then the system officially enters user mode, with the terminal showing:

```bash
init: starting sh
#  
```
