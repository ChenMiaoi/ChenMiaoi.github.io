---
title: 'xv6: The Spin Lock'
mathjax: true
date: 2024-06-24 18:22:51
tags: [xv6, os, risc-v]
categories: [xv6]
---

# XV6 Operator System: 04-The Spin Lock

在上一节中，我简单介绍了内核态中的入口函数`main()`。如果按照入口函数中的初始化顺序，理应讲解`consoleinit()`，但是位于`consoleinit`中有涉及到其余部分的介绍，为了每个章节的独立性和可读性，并且为了避免一次性知识的复杂程度过高，这里选择率先讲解`spinlock`。

在这一节中，我并不打算详细介绍什么是“锁”，只会简单的提一点最为基本的概念以及锁的种类。

**锁是一种用于控制多线程或多进程环境中资源访问的同步机制。它的主要作用是防止数据竞争和保持数据一致性。当多个线程或进程需要访问共享资源时，锁可以确保同一时间只有一个线程或进程可以访问该资源，从而避免并发操作带来的问题**。

一般而言，常见的锁有：

|          种类           |              用途               |
|:---------------------:|:-----------------------------:|
|    互斥锁(Mutex Lock)    | 适用于需要严格防止并发访问的场景，如更新共享变量或文件操作 |
| 读写锁 (Read-Write Lock) |       适用于读多写少的场景，例如缓存系统       |
| 递归锁 (Recursive Lock)  |   适用于需要递归调用且每次调用都需要获取同一锁的场景   |
|    自旋锁 (Spin Lock)    | 适用于锁持有时间很短的场景，因为自旋锁会消耗 CPU 资源 | 


而在`xv6-riscv`中，我们主要实现的锁便是自旋锁。`xv6`的目标是尽可能简单地展示操作系统的基本原理。**自旋锁的实现相对简单，不需要处理复杂的上下文切换或线程调度问题**。实现其他类型的锁（如互斥锁、读写锁）需要更复杂的调度机制和上下文切换管理，这会增加内核的复杂性。而自旋锁只需要简单的检查和自旋等待，不需要操作系统调度线程的切换，简化了内核的实现。

同时，在自旋锁中，由于线程在等待锁的时候不会进行上下文切换，这在某些情况下反而更加高效，特别是在临界区执行时间极短的情况下。避免上下文切换的开销，可以提升系统性能。

## Lock

多个$CPU$的`xv6`共享物理内存，并且利用共享来维护所有$cpu$读取和写入的数据结构。而共享数据则是增加了一个$CPU$在读取数据的同时，另一个$CPU$正在更新该数据结构的可能性，甚至多个$CPU$同时更新。哪怕在单核中，内核也可能不断的在$CPU$中切换大量线程，使得它们交替执行。**并发一词指的是由于多处理器并行性、线程切换或中断而导致多条指令流交错的情况**。

内核中总是充斥着许多并行数据，内核设计者们为了让内核使用并行以增加其性能和响应性，不得不允许了大量并发的存在。为了不造成严重错误，又设计出并发控制技术来解决这一问题。

这一节主要涉及到并发控制及技术中最为广泛使用的一项技术：锁。锁提供了互斥性，确保了一次只能一个$CPU$享有锁。也就是说，如果一个数据结构使用锁来保护其数据，那么锁就使得一次只有一个$CPU$能够使用该数据。尽管锁是一种极其简单有效的机制，但是大量使用锁会使得性能下降，因为它使其变为了单独的序列化执行。

![Simplified SMP architecture](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406251020809.png)

## Races

考虑一下这个例子：两个具有退出子进程的进程在两个不同的$CPU$上调用`wait`，而`wait`会释放这两个子进程的内存。因此，对于这两个$CPU$而言，内核会调用`kfree`来回收这两个子进程的内存页。`xv6`的内核分配器维护了一个链表`kalloc()`，`kalloc`会从空闲链表中弹出一页内存，而`kfree`就会将这页内存给回收。

下图展示了一个详细情况：空闲页面的链表位于两个$CPU$的共享内存中，它们使用`load`和`store`指令操作该链表：

![Example race](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406251030024.png)

如果不考虑并发情况，那么你可能会这样实现：

``` cpp
struct element {
    int data;
    struct element* next;  
};

struct element* list = NULL;

void push(int data) {
    struct element* l;
    l = malloc( sizeof *l );
    l->data = data;
    l->next = list;
    list = l;
}
```

在上面我们说过，如果这段代码是单进程下，那么是正确的。如果两个$CPU$同时执行`push`，因此这两个$CPU$都可能会在`list = l`前执行`l->next = list`。那么就会导致上面图示的结果，两个元素确实插入到链表中，但是第一次对于链表的数据的赋值会发生在第二个节点上，并且第二次的赋值会覆盖掉第一次的赋值，并且第一个节点是没有值的。

这就是竞争的一个简单例子。竞争是一种发生在一块内存被并发访问，并且其中至少有一个操作是写入时的一种状态。**竞争的结果取决于编译器生成的机器码、所涉及的两个$cpu$的计时以及它们的内存操作如何由内存系统排序，这可能使竞争引起的错误难以重现和调试**。

避免竞争发生的常用方法就是锁。锁的存在保证了互斥性，以至于一次只有一个$cpu$能够执行一些敏感数据：

``` cpp
struct element* list = NULL;
struct lock listlock;

void push(int data) {
    struct element* l;
    l = malloc( sizeof *l );
    l->data = data;
    
    acquire(&listlock);
    l->next = list;
    list = l;
    release(&listlock);
}
```

位于`acquire`和`release`之间的代码片段被称为`临界区(critical section)`。

当我们说锁保护数据时，通常而言是指锁保护应用于数据的一些不变量集合。不变量才是跨操作维护数据结构的属性。换言之，一个操作的是否正确取决于操作时的不变量是否正确。

你可以将锁视为序列化并发临界区，以便它们一次运行一个，从而保留不变量。你还可以将由同一锁保护的临界区视为彼此之间的原子性，因此每个临界区都只能看到来自早期临界区的完整更改集，而永远不会看到部分完成的更新。

**内核设计中的一个主要挑战是，在追求并行性时避免锁争用**。`xv6`在这方面做得很少，但复杂的内核会专门组织数据结构和算法以避免锁争用。

## Spin Lock's Code

在`xv6`种实际上是存在两种锁的，一种则是`自旋锁(spin lock)`，另一种是`睡眠锁(sleep lock)`。我们首先从自旋锁开始介绍。

在`xv6`中，自旋锁的结构是在[kernel/spinlock.h:2](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.h#L2)中被定义的：

``` cpp
// Mutual exclusion lock.
struct spinlock {
  uint locked;      // Is the lock held?

  // For debugging:
  char *name;       // Name of lock.
  struct cpu *cpu;  // The cpu holding the lock.
};
```

其中，最为主要的一个元素自然是`locked`，这用于标识是否上锁：**当锁可用时，其值为零；锁被拥有时，为非零**。

然后我们可以在[kernel/spinlock.c](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c)中查看其余函数的定义和实现。

### initlock

不止在锁这一个模块中，其余每个模块基本上都会存在一个初始化函数，用于在内核进入时统一初始化。

``` cpp
void initlock(struct spinlock *lk, char *name) {
  lk->name = name;
  lk->locked = 0;
  lk->cpu = 0;
}
```

对于锁的初始化而言，没有过多讲解的必要。这里额外讲解一点$cpu$的结构信息：

``` cpp
// Per-CPU state.
struct cpu {
  struct proc *proc;          // The process running on this cpu, or null.
  struct context context;     // swtch() here to enter scheduler().
  int noff;                   // Depth of push_off() nesting.
  int intena;                 // Were interrupts enabled before push_off()?
};
extern struct cpu cpus[NCPU];

// Return this CPU's cpu struct.
// Interrupts must be disabled.
struct cpu *mycpu(void) {
  int id = cpuid();
  struct cpu *c = &cpus[id];
  return c;
}
```

对于`proc`和`context`这两个字段的含义，有些读者可能能够理解，但是目前暂时不需要过多的讲解，因为在此处不会有更多的使用。我们主要了解`noff`和`intena`，前者是关于锁嵌套的深度，而后者则是在获取锁之前，该$CPU$的中断使能状态信息。

因此对于锁而言，**我们在获取锁后为了避免死锁的发生，需要关闭中断使得获取锁后不会因为中断的发生而导致跳出锁的作用范围**。因此，我们就需要率先获取获取锁之前的状态，然后关闭中断使能，后续释放锁后，再根据获取的状态进行恢复使能状态。

对于`cpus`和`mycpu()`，则是针对于现代计算机多核的一种设计，我们在处理锁的时候，需要锁住当前$cpu$状态就需要使用。

### push_off && pop_off

[push_off](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#L80)和[pop_off](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#L89)函数的设计和作用主要与中断的管理有关，以确保在持有自旋锁期间不发生上下文切换，从而避免死锁和竞争条件。

`push_off`函数的主要作用是**禁用当前处理器的中断，并记录之前的中断状态。其设计目的是确保在持有自旋锁期间，中断不会打断当前的执行流，从而避免由于中断处理程序尝试获取相同自旋锁而导致的死锁**。

``` cpp
void push_off(void) {
  int old = intr_get();

  intr_off();
  if (mycpu()->noff == 0)
    mycpu()->intena = old;
  mycpu()->noff += 1;
}

static inline void intr_off() { w_sstatus(r_sstatus() & ~SSTATUS_SIE); }

// are device interrupts enabled?
static inline int intr_get() {
  uint64 x = r_sstatus();
  return (x & SSTATUS_SIE) != 0;
}
```

在上面的实现中，`intr_get()`会获取`mstatus`寄存器，用于读取当前中断使能状态，然后通过`intr_off()`关闭中断。当`cpu`是第一次获取锁时，其中的`intena`会保存之前的使能状态以供后续恢复。

`pop_off`函数的主要作用是**恢复之前的中断状态。其设计目的是在完成对共享资源的访问后，重新启用中断**(**如果在获取自旋锁之前中断是启用的**)。

``` cpp
void pop_off(void) {
  struct cpu *c = mycpu();
  if (intr_get())
    panic("pop_off - interruptible");
  if (c->noff < 1)
    panic("pop_off");
  c->noff -= 1;
  if (c->noff == 0 && c->intena)
    intr_on();
}

// enable device interrupts
static inline void intr_on() { w_sstatus(r_sstatus() | SSTATUS_SIE); }
```

需要注意的是，解锁的过程中也是处于关中断状态的，因此我们需要判断此时的中断状态以及`noff`字段。然后通过`intena`判断是否使用`intr_on()`恢复中断使能状态。

### acquire && release

在`xv6`中，我们最为常用的两个自旋锁接口是[acquire](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#19)和[release](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#42)。`acquire`和`release`函数用于管理自旋锁，它们分别用于获取和释放锁，从而确保对共享资源的互斥访问。

`acquire`函数用于获取自旋锁。它的主要步骤包括禁用中断、检查当前锁状态、尝试获取锁以及记录当前持有锁的CPU。

``` cpp
void acquire(struct spinlock *lk) {
  push_off(); // disable interrupts to avoid deadlock.
  if (holding(lk))
    panic("acquire");

  while (__sync_lock_test_and_set(&lk->locked, 1) != 0)
    ;
  __sync_synchronize();

  lk->cpu = mycpu();
}
```

我们在上面知道，整个锁的环节都是需要在关中断的状态下完成的，因此关中断肯定是获取锁的第一步。然后我们需要判断该$cpu$是否以及获取过一次锁，如果以及获取锁，那么就会导致错误，因为两个锁的同时拥有会导致问题频发。

``` cpp
int holding(struct spinlock *lk) {
  int r;
  r = (lk->locked && lk->cpu == mycpu());
  return r;
}
```

判断有条件拥有锁后，我们就需要设置`locked`字段，这里使用了$GCC$提供的内置的原子操作`__sync_lock_test_and_set`，它是一个$atomic exchange operation$，这样就使得**执行交换操作期间不会发生其他线程或进程的干扰，从而保证交换操作是原子的**。因此`locked`就被置为了`1`，并且其返回值是原先的旧值。因此，如果锁被其他$cpu$所持有，那么就会一直在`while`中循环直到获取锁，因此被称为自旋锁。

> 原子交换操作($atomic exchange operation$)
> 原子交换操作是一种并发编程中的操作，用于在多线程或多进程环境下实现原子性的值交换。它确保在执行交换操作期间不会发生其他线程或进程的干扰，从而保证交换操作是原子的。   
> 在并发环境中，多个线程或进程可以同时访问和修改共享的变量。当多个线程或进程需要同时对某个变量进行读取和写入时，就可能发生竞态条件(race condition)，导致不确定的结果或数据不一致的情况。原子交换操作提供了一种解决竞态条件问题的机制。  
> 原子交换操作通常包括两个步骤：读取变量的当前值并将新值写入变量。这两个步骤被视为一个原子操作，要么完全执行成功，要么完全不执行。原子交换操作通常使用底层的硬件指令或操作系统提供的原子操作函数来实现。  

然后通过`__sync_synchronize`内置函数，用于提交一个`fence`指令进行内存屏障操作。

``` asm
; __sync_lock_test_and_set
; a5 = 1
; s1 = &lk->locked

amoswap.w.aq a5, a5, (s1)
```

> AMOSWAP  
> AMOSWAP指令用于在多线程或多处理器环境下执行原子性的值交换操作。它允许程序原子地读取一个内存位置的当前值，并将一个新值写入该位置。该指令确保在执行交换操作期间不会发生其他线程或处理器的干扰，从而保证交换操作是原子的

![riscv Atomic Memory Operations](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406261048339.png)

最后，将当前$cpu$的结构信息保存在锁中，用于后续判断和调试。

`release`函数用于释放自旋锁。它的主要步骤包括检查当前持有锁的$CPU$、清除持有锁的$CPU$信息、释放锁以及恢复中断状态。

``` cpp
void release(struct spinlock *lk) {
  if (!holding(lk))
    panic("release");

  lk->cpu = 0;

  __sync_synchronize();

  __sync_lock_release(&lk->locked);

  pop_off();
}
```

可以看见，首先需要判断的就是当前$cpu$是否含有锁，如果不持有锁，那么`release`操作肯定就是有问题的。然后我们清空锁持有的$cpu$状态。

在释放锁前，我们需要同步一下$cpu$的状态，因此使用`__sync_synchronize`提交`fence`指令。然后通过内建的原子操作`__sync_lock_release`用于释放通过`__sync_lock_test_and_set`的设置值。

``` asm
; sync_lock_release
; s1 = &lk->locked
amoswap.w zero, zero, (s1)
```

最后，通过`pop_off`恢复$cpu$的中断使能状态。

---

至此，关于`xv6`的自旋锁源码就解释完了。

## Deadlock and Lock Ordering

如果内核中的某个代码路径必须同时持有多个锁，那么确保所有代码路径以相同的顺序获取这些锁是非常重要的。如果它们不按照相同的顺序获取锁，就会存在死锁的风险。

假设在`xv6`操作系统中有两个代码路径需要锁$A$和$B$，但是代码路径`1`按照$A$然后$B$的顺序获取锁，而另一个代码路径按照$B$然后$A$的顺序获取锁。假设线程`T1`执行代码路径`1`并获取了锁$A$，线程`T2`执行代码路径`2`并获取了锁$B$。接下来，`T1`将尝试获取锁$B$，而`T2`将尝试获取锁$A$。由于在这两种情况下，另一个线程持有所需的锁，并且在其获取返回之前不会释放它，因此两个获取操作都将无限期地阻塞。为了避免这种死锁情况，**所有代码路径必须按照相同的顺序获取锁。对于全局锁获取顺序的需求意味着锁实际上是每个函数规范的一部分：调用者必须以一种使得按照约定的顺序获取锁的方式调用函数**。

|       Lock       |     Description      |
|:----------------:|:--------------------:|
|   bcache.lock    |      保存块缓冲条目的分配      |
|    cons.lock     |  序列化对终端硬件的访问，避免混合输出  |
|   ftable.lock    |    序列化文件表中结构文件的分配    |
|   itable.lock    |   保护内存中inode条目的分配    | 
|    vdisk.lock    | 序列化对磁盘硬件和DMA描述符队列的访问 |
|    kmem.lock     |       序列化内存分配        | 
|     log.lock     |     序列化事务日志上的操作      | 
| pipe's pi->lock  |     序列化每个管道上的操作      |
|     pid_lock     |    序列化next_pid的增量    |
|  proc's p->lock  |      序列化进程状态的更改      |
|    wait_lock     |      帮助等待避免丢失唤醒      |
|    tickslock     |     序列化计时计数器上的操作     |
| inode's ip->lock |  序列化每个索引节点及其内容上的操作   |
|  buf's b->lock   |    序列化每个块缓冲区上的操作     |

出于这种情况，`xv6`的`struct proc`有一个`chain`字段，用于`sleep`和锁的协同作用。这样就避免了死锁的发生。例如：`consoleintr`是处理键入字符的中断例程。当输入一个换行符时，任何正在等待控制台输入的进程都应该被唤醒。为了实现这一点，`consoleintr`在调用`wakeup`时持有`cons.lock`，而`wakeup`会获取等待进程的锁以唤醒它。因此，为了避免全局死锁，锁的获取顺序规则中包括了`cons.lock`必须在任何进程锁之前获取的规定。文件系统代码包含了`xv6`中最长的锁链。例如，创建一个文件需要同时持有目录的锁、新文件的`inode`的锁、磁盘块缓冲区的锁、磁盘驱动器的`vdisk_lock`以及调用进程的`p->lock`。为了避免死锁，文件系统代码总是按照前面提到的顺序获取锁。
