---
slug: xv6-The-Spin-Lock.en
title: 'xv6: The Spin Lock'
published: 2024-06-24
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
lang: "en"
---
In the previous section, I briefly introduced the kernel-mode entry function `main()`. If we followed the initialization order in the entry function, we should cover `consoleinit()` next. However, `consoleinit` involves other parts of the system, so to keep each chapter independent and readable, and to avoid introducing too much complexity at once, I've chosen to explain `spinlock` first.

In this section, I don't plan to explain in detail what a "lock" is — I'll only briefly touch on the most basic concepts and the types of locks.

**A lock is a synchronization mechanism used to control access to resources in multithreaded or multiprocess environments. Its main purpose is to prevent data races and maintain data consistency. When multiple threads or processes need to access a shared resource, a lock ensures that only one thread or process can access the resource at a time, thereby avoiding problems caused by concurrent operations.**

Generally speaking, the common types of locks are:

|         Type          |                           Purpose                            |
|:---------------------:|:-----------------------------------------------------------:|
|    Mutex Lock         | Suitable for scenarios that must strictly prevent concurrent access, such as updating shared variables or file operations |
| Read-Write Lock       | Suitable for read-heavy, write-rare scenarios, such as cache systems |
| Recursive Lock        | Suitable for scenarios involving recursive calls where each call needs to acquire the same lock |
| Spin Lock             | Suitable for scenarios where the lock is held for a very short time, because a spin lock consumes CPU resources |


In `xv6-riscv`, the lock we mainly implement is the spin lock. The goal of `xv6` is to demonstrate the fundamental principles of operating systems as simply as possible. **Spin locks are relatively simple to implement and don't require handling complex context switching or thread scheduling**. Implementing other types of locks (such as mutex locks or read-write locks) requires more complex scheduling mechanisms and context-switch management, which would increase kernel complexity. A spin lock, on the other hand, only needs simple checking and spin-waiting, without requiring the operating system to schedule thread switches, which simplifies the kernel implementation.

Meanwhile, with spin locks, threads don't undergo context switching while waiting for the lock, which in some cases is actually more efficient — especially when the critical section executes extremely quickly. Avoiding the overhead of context switching can improve system performance.

## Lock

In `xv6`, multiple $CPU$s share physical memory, and xv6 takes advantage of this sharing to maintain data structures that all $cpu$s read and write. This sharing introduces the possibility that one $CPU$ is reading a data structure while another $CPU$ is updating it, or even that multiple $CPU$s update it simultaneously. Even on a single core, the kernel may constantly switch a large number of threads on the $CPU$, causing them to execute in an interleaved fashion. **The term concurrency refers to situations in which multiple instruction streams interleave due to multiprocessor parallelism, thread switching, or interrupts**.

The kernel is always full of parallel data. In order for the kernel to exploit parallelism to improve its performance and responsiveness, kernel designers have had to allow a great deal of concurrency. To avoid serious errors, they designed concurrency control techniques to address this problem.

This section focuses on the most widely used concurrency control technique: the lock. Locks provide mutual exclusion, ensuring that only one $CPU$ can hold a lock at a time. In other words, if a data structure uses a lock to protect its data, then the lock ensures that only one $CPU$ can use that data at a time. Although locks are an extremely simple and effective mechanism, heavy use of locks degrades performance, because it turns execution into a serialized sequence.

![Simplified SMP architecture](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406251020809.png)

## Races

Consider this example: two processes with exited child processes call `wait` on two different $CPU$s, and `wait` frees the memory of the two child processes. For these two $CPU$s, the kernel calls `kfree` to reclaim the two child processes' memory pages. The `xv6` kernel allocator maintains a linked list: `kalloc()` pops a page of memory from the free list, while `kfree` returns that page of memory to the list.

The following figure shows this situation in detail: the free-page list lives in memory shared by the two $CPU$s, which manipulate the list using `load` and `store` instructions:

![Example race](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406251030024.png)

If you don't take concurrency into account, you might implement it like this:

```cpp
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

As we said above, this code is correct in a single-process setting. If two $CPU$s execute `push` at the same time, both $CPU$s may execute `l->next = list` before either executes `list = l`. That would produce the result shown in the figure above: both elements do get inserted into the list, but the first assignment of the list data happens at the second node, and the second assignment overwrites the first, leaving the first node without a value.

This is a simple example of a race. A race is a situation that arises when a memory location is accessed concurrently and at least one of the accesses is a write. **The outcome of a race depends on the machine code generated by the compiler, the timing of the two $cpu$s involved, and how their memory operations are ordered by the memory system — which can make race-induced errors hard to reproduce and debug**.

The usual way to avoid races is a lock. The existence of a lock guarantees mutual exclusion, so that only one $cpu$ at a time can execute code touching sensitive data:

```cpp
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

The code between `acquire` and `release` is called the `critical section`.

When we say a lock protects data, we usually mean that the lock protects some set of invariants that apply to the data. The invariants are the properties of the data structure maintained across operations. In other words, whether an operation is correct depends on whether the invariants hold at the time the operation is performed.

You can think of a lock as serializing concurrent critical sections so that they run one at a time, thereby preserving the invariants. You can also view critical sections protected by the same lock as atomic with respect to each other, so that each critical section only ever sees the complete set of changes from earlier critical sections and never sees a partially completed update.

**A major challenge in kernel design is avoiding lock contention while pursuing parallelism**. `xv6` does little in this regard, but sophisticated kernels deliberately organize their data structures and algorithms to avoid lock contention.

## Spin Lock's Code

In `xv6` there are actually two kinds of locks: one is the `spin lock`, and the other is the `sleep lock`. We'll start with the spin lock.

In `xv6`, the spin lock structure is defined in [kernel/spinlock.h:2](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.h#L2):

```cpp
// Mutual exclusion lock.
struct spinlock {
  uint locked;      // Is the lock held?

  // For debugging:
  char *name;       // Name of lock.
  struct cpu *cpu;  // The cpu holding the lock.
};
```

The most important field is naturally `locked`, which indicates whether the lock is held: **when the lock is free, its value is zero; when the lock is owned, it is nonzero**.

We can then look at the definitions and implementations of the other functions in [kernel/spinlock.c](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c).

### initlock

Not just in the lock module — essentially every module has an initialization function that runs when the kernel starts up.

```cpp
void initlock(struct spinlock *lk, char *name) {
  lk->name = name;
  lk->locked = 0;
  lk->cpu = 0;
}
```

There's not much that needs explaining about lock initialization. Here I'll add a bit of extra information about the $cpu$ structure:

```cpp
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

Some readers may already understand the meaning of the `proc` and `context` fields, but we don't need to go into detail for now, since they won't be used any further here. We mainly care about `noff` and `intena`: the former records the depth of lock nesting, and the latter records this $CPU$'s interrupt-enable state before the lock was acquired.

Therefore, for locks, **after acquiring a lock we need to disable interrupts in order to avoid deadlock, so that an interrupt cannot cause execution to leave the lock's scope while the lock is held**. This means we must first save the state from before acquiring the lock, then disable interrupts; later, after releasing the lock, we restore the enable state from the saved value.

`cpus` and `mycpu()` are designed for the multi-core nature of modern computers; we need them whenever we have to lock down the current $cpu$'s state while working with locks.

### push_off && pop_off

The design and purpose of the [push_off](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#L80) and [pop_off](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#L89) functions mainly concern interrupt management: they ensure that no context switch happens while a spin lock is held, thereby avoiding deadlocks and race conditions.

The main purpose of the `push_off` function is to **disable interrupts on the current processor and record the previous interrupt state. It is designed to ensure that while a spin lock is held, interrupts cannot break into the current execution flow, thereby avoiding the deadlock that would occur if an interrupt handler tried to acquire the same spin lock**.

```cpp
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

In the implementation above, `intr_get()` reads the `mstatus` register to obtain the current interrupt-enable state, and then `intr_off()` disables interrupts. When the `cpu` acquires a lock for the first time, its `intena` saves the previous enable state for later restoration.

The main purpose of the `pop_off` function is to **restore the previous interrupt state. It is designed to re-enable interrupts after access to the shared resource is complete** (**if interrupts were enabled before the spin lock was acquired**).

```cpp
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

Note that interrupts are still disabled during the unlock process, so we need to check the current interrupt state and the `noff` field. We then use `intena` to decide whether to call `intr_on()` to restore the interrupt-enable state.

### acquire && release

In `xv6`, the two most commonly used spin lock interfaces are [acquire](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#19) and [release](https://github.com/mit-pdos/xv6-riscv/blob/riscv//kernel/spinlock.c#42). The `acquire` and `release` functions manage the spin lock; they acquire and release the lock respectively, thereby ensuring mutually exclusive access to shared resources.

The `acquire` function acquires a spin lock. Its main steps include disabling interrupts, checking the current lock state, attempting to acquire the lock, and recording the CPU that currently holds the lock.

```cpp
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

As we learned above, the entire lock sequence must be completed with interrupts disabled, so disabling interrupts is definitely the first step in acquiring a lock. Then we need to check whether this $cpu$ has already acquired the lock; if it already holds the lock, that's an error, because holding the same lock twice leads to frequent problems.

```cpp
int holding(struct spinlock *lk) {
  int r;
  r = (lk->locked && lk->cpu == mycpu());
  return r;
}
```

After confirming that the lock is not already held, we need to set the `locked` field. Here we use the built-in atomic operation `__sync_lock_test_and_set` provided by $GCC$, which is an $atomic exchange operation$. This ensures that **no other thread or process can interfere during the exchange, so the exchange operation is guaranteed to be atomic**. As a result, `locked` is set to `1`, and the return value is the original old value. Therefore, if the lock is held by another $cpu$, execution keeps looping in the `while` until the lock is acquired — which is exactly why it's called a spin lock.

> Atomic Exchange Operation ($atomic exchange operation$)
> An atomic exchange operation is an operation in concurrent programming used to atomically swap values in multithreaded or multiprocess environments. It ensures that no other thread or process interferes during the exchange, thereby guaranteeing that the exchange operation is atomic.   
> In a concurrent environment, multiple threads or processes can access and modify shared variables at the same time. When multiple threads or processes need to read and write the same variable simultaneously, a race condition can occur, leading to indeterminate results or inconsistent data. Atomic exchange operations provide a mechanism for solving race-condition problems.  
> An atomic exchange operation usually consists of two steps: reading the variable's current value and writing a new value into the variable. These two steps are treated as a single atomic operation — either both complete successfully, or neither is performed at all. Atomic exchange operations are typically implemented using low-level hardware instructions or atomic-operation functions provided by the operating system.  

Then, the `__sync_synchronize` built-in function is used to issue a `fence` instruction, performing a memory-barrier operation.

```asm
; __sync_lock_test_and_set
; a5 = 1
; s1 = &lk->locked

amoswap.w.aq a5, a5, (s1)
```

> AMOSWAP  
> The AMOSWAP instruction performs an atomic value-exchange operation in multithreaded or multiprocessor environments. It allows a program to atomically read the current value of a memory location and write a new value to that location. The instruction ensures that no other thread or processor interferes during the exchange, thereby guaranteeing that the exchange operation is atomic.

![riscv Atomic Memory Operations](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406261048339.png)

Finally, the current $cpu$'s structure information is saved in the lock for later checking and debugging.

The `release` function releases a spin lock. Its main steps include checking which $CPU$ currently holds the lock, clearing the holding-$CPU$ information, releasing the lock, and restoring the interrupt state.

```cpp
void release(struct spinlock *lk) {
  if (!holding(lk))
    panic("release");

  lk->cpu = 0;

  __sync_synchronize();

  __sync_lock_release(&lk->locked);

  pop_off();
}
```

As you can see, the first thing to check is whether the current $cpu$ holds the lock; if it doesn't, then the `release` operation is definitely wrong. We then clear the $cpu$ state held in the lock.

Before releasing the lock, we need to synchronize the $cpu$'s state, so we use `__sync_synchronize` to issue a `fence` instruction. Then the built-in atomic operation `__sync_lock_release` releases the value set by `__sync_lock_test_and_set`.

```asm
; sync_lock_release
; s1 = &lk->locked
amoswap.w zero, zero, (s1)
```

Finally, `pop_off` restores the $cpu$'s interrupt-enable state.

---

This concludes the explanation of the `xv6` spin lock source code.

## Deadlock and Lock Ordering

If a code path in the kernel must hold multiple locks at the same time, it's very important to ensure that all code paths acquire those locks in the same order. If they don't acquire the locks in the same order, there's a risk of deadlock.

Suppose two code paths in the `xv6` operating system need locks $A$ and $B$, but code path `1` acquires lock $A$ and then lock $B$, while the other code path acquires lock $B$ and then lock $A$. Suppose thread `T1` executes code path `1` and acquires lock $A$, and thread `T2` executes code path `2` and acquires lock $B$. Next, `T1` will try to acquire lock $B$, and `T2` will try to acquire lock $A$. In both cases, the other thread holds the required lock and won't release it before its own acquisition returns, so both acquisitions will block indefinitely. To avoid this kind of deadlock, **all code paths must acquire locks in the same order. The need for a global lock-acquisition order means that locks are effectively part of each function's specification: callers must invoke functions in a way that causes locks to be acquired in the agreed-upon order**.

|       Lock       |                  Description                   |
|:----------------:|:----------------------------------------------:|
|   bcache.lock    |    Protects allocation of block buffer entries    |
|    cons.lock     |  Serializes access to terminal hardware, avoiding intermixed output  |
|   ftable.lock    |    Serializes allocation of struct file in the file table    |
|   itable.lock    |   Protects allocation of in-memory inode entries    | 
|    vdisk.lock    | Serializes access to disk hardware and the DMA descriptor queue |
|    kmem.lock     |       Serializes memory allocation        | 
|     log.lock     |     Serializes operations on the transaction log      | 
| pipe's pi->lock  |     Serializes operations on each pipe      |
|     pid_lock     |    Serializes increments of next_pid    |
|  proc's p->lock  |      Serializes changes to process state      |
|    wait_lock     |      Helps wait avoid lost wakeups      |
|    tickslock     |     Serializes operations on the tick counter     |
| inode's ip->lock |  Serializes operations on each inode and its contents   |
|  buf's b->lock   |    Serializes operations on each block buffer     |

For this situation, xv6's `struct proc` has a `chain` field, used by `sleep` in cooperation with locks. This avoids deadlock. For example: `consoleintr` is the interrupt routine that handles typed characters. When a newline is typed, any process waiting for console input should be woken up. To accomplish this, `consoleintr` holds `cons.lock` while calling `wakeup`, and `wakeup` acquires the waiting process's lock in order to wake it up. Therefore, to avoid a global deadlock, the lock-acquisition-order rules include the rule that `cons.lock` must be acquired before any process lock. The file-system code contains the longest lock chain in `xv6`. For example, creating a file requires simultaneously holding the lock on the directory, the lock on the new file's `inode`, the lock on the disk block buffer, the disk driver's `vdisk_lock`, and the calling process's `p->lock`. To avoid deadlock, the file-system code always acquires locks in the order mentioned above.
