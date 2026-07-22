---
slug: Concurrency-in-Action-Introduction.en
title: 'Concurrency in Action: Introduction'
published: 2024-06-12
tags:
  - cpp
  - concurrency
category: books
series: concurrency-in-action
lang: "en"
---
This series of notes is about how to write multithreaded concurrent applications in C++, along with an analysis of C++'s multithreading features and library tools. It is still worth noting that the notes in this series **represent only my personal understanding; if you find any errors, please send me a message by email** (<chenmiao.ku@gmail.com>).

## What is concurrency?

At the simplest and most basic level, **concurrency means two or more independent activities happening at the same time**. Concurrency is part of our daily lives: we can talk while walking, perform different actions with each hand, or live our lives independently of one another...

### Concurrency in computers systems

Whenever we talk about the computer term "concurrency," we mean **a single system** performing **multiple independent activities in parallel, rather than sequentially or one after another**.

Historically, most desktop computers had one processor with a single processing unit or core (of course, most computers today are dual-core or multi-core). **Such a (single-core) computer can only handle one task at a time, but it can keep switching between tasks — doing a bit of one task, then a bit of another — which makes it look like the tasks are happening in parallel**. This is called `task switching`. Note that **because task switching happens so fast, you cannot tell at which point a task is suspended when one task is switched out for the next**. Also, **task switching gives users and applications an *illusion of concurrency*, which means the behavior of an application may differ subtly from how it behaves when running on a computer capable of true concurrency**.

In the past, computers with multiple processors were typically used for servers or high-performance computing tasks; today, multi-core desktop computers are increasingly common. **Whether these computers have multiple processors or multiple processing cores within a single processor, they can run these tasks truly in *parallel***. We call this `hardware concurrency`.

The figure below shows an idealized scenario in which a computer has exactly two tasks, each divided into ten equal-sized chunks. On a dual-core machine, each task can run on its own core; but on a single-core machine, task switching is required, and the chunks of each task are interleaved. For a system to interleave tasks, it must perform a `context switch` every time it switches from one task to another, which costs a certain amount of time.

To perform a context switch, **the system has to save the $CPU$ state and instruction pointer for the *currently running* task, work out which task to switch to, and reload the $CPU$ state for the task being switched to**. **Then, the $CPU$ may need to load the new task's instructions and data into the cache, which can prevent the $CPU$ from executing any instructions and cause further delays**.

![Two approaches to concurrency: parallel execution on a dual-core machine versus task switching on a single-core machine](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406121520627.png)

> When the operating system decides to switch to another task, the CPU needs to load the new task's instructions and data into the cache. This is because the cache is temporary storage that the CPU uses to quickly access data in memory. If the new task's instructions and data are not in the cache, the CPU has to read them from main memory, which takes more time and resources. 
> This loading process may prevent the CPU from executing any instructions, because it has to wait until the new task's data is ready in the cache. This causes further delays, since the CPU cannot proceed with other instructions until the new task's data is ready. 
> Once the new task's data has been loaded into the cache, the CPU can start executing the new task's instructions. But in the meantime, the delay caused by loading data and waiting adds up to extra overall latency. 
> This kind of delay is unavoidable during task switching, but its impact can be reduced by optimizing cache and memory access strategies, thereby improving system performance.

Although concurrency in hardware is most obvious in multiprocessor or multicore systems, some processors can execute multiple threads on a single core. **The important factor to consider is the number of** `hardware threads`, **which is the measure of how many independent tasks the hardware can genuinely run concurrently**. Even with systems that have true hardware concurrency, it is easy for the number of tasks to exceed what the hardware can run in parallel, so task switching is still used in these situations. As shown in the figure below, task switching of four tasks takes place on a dual-core computer, and as in the previous idealized scenario, each task is divided into equal-sized chunks.

![Task switching of four tasks on two cores](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406121540787.png)

### Approaches to concurrency

Here is an example: imagine a pair of programmers working together on a software project. If your developers are in separate offices, they can work in peace without being disturbed by each other, and each of them has their own set of reference manuals. But obviously, communication is not straightforward; they have to use the phone or email, or get up and walk to the other's office. In addition, you have to manage two offices and buy multiple copies of the reference manuals.

Now suppose you move them into the same office. They can now talk to each other freely or discuss the design of the application. You only need to manage one office and buy one set of reference manuals; however, they may find it hard to concentrate, and there may be resource problems (one set of reference manuals).

The two arrangements above illustrate the two basic approaches to concurrency. Each developer corresponds to a thread, the office represents a process, and the reference manuals are resources.

#### CONCURRENCY WITH MULTIPLE PROCESSORS

The first way to use concurrency in an application is to **divide the application into multiple separate, single-threaded processes that run at the same time**. These separate processes can then pass messages to each other through all the normal interprocess communication channels (`signals`, `sockets`, `files`...).

The downside of this approach is: **communication between processes is either complicated to set up, slow, or both; and there is an inherent overhead in running multiple processes — starting a process takes time, and the operating system must devote internal resources to managing those processes**.

Of course, it is not all bad: **the operating system usually provides additional protection between processes and high-level communication mechanisms, which means it is easier to write safe concurrent code using processes rather than threads; and you can run separate processes on different machines connected over a network. Although this increases the cost of communication, on a carefully designed system it can be a cost-effective way of increasing the available parallelism and improving performance**.

> Distributing multiple processes across multiple hosts over a network is called distributed computing.

![communicate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406121631041.png)

#### CONCURRENCY WITH MULTIPLE THREADS

The alternative approach to concurrency is to **run multiple threads in a single process**. **Threads are much like *lightweight processes*: each thread runs independently of the others, and each thread can run a different sequence of instructions**. However, **all threads in a process share the same address space, and most of the data can be accessed directly from all threads — global variables remain global, and pointers, objects, or references to data can be passed around between threads**. Although threads can share the address space of a process, setting them up and managing them is still complicated, **because the memory addresses of the same data are not necessarily the same in different processes**.

**The shared address space and lack of protection of data between threads makes the overhead of using multiple threads much smaller than that of using multiple processes**. But **the flexibility of shared memory comes at a price: if data is accessed by multiple threads, the application programmer must *ensure that the view of the data seen by each thread is consistent whenever it is accessed***.

Compared with launching and communicating between multiple processes, **launching and communicating between multiple threads within a process has lower overhead, which makes this the most popular approach to concurrency in mainstream languages, despite the potential problems arising from shared memory**. Furthermore, **the C++ Standard does not provide any intrinsic support for communication between processes, so *applications that use multiple processes will have to rely on platform-specific APIs to do so.***

### Concurrency vs. Parallelism

With multithreaded code, `concurrency` and `parallelism` overlap considerably in meaning. In fact, most of the time they refer to the same thing; the difference lies mainly in nuance, focus, and intent.

Both terms are about running multiple tasks simultaneously using the available hardware, but **parallelism is much more performance-oriented**. **When people are primarily concerned with using the available hardware to increase the performance of bulk data processing, they talk about parallelism**; **and when people are primarily concerned with separation of concerns or responsiveness, they talk about concurrency**.

- Parallelism emphasizes executing multiple tasks simultaneously to improve overall performance. It focuses on how to make full use of hardware resources such as multi-core processors or distributed systems to process multiple tasks at the same time, achieving faster data processing. The goal of parallelism is to speed up the computation process by handling multiple tasks simultaneously.
- Concurrency, on the other hand, focuses more on the separation of tasks and responsiveness. It focuses on how to handle multiple tasks so that they can execute concurrently rather than simply sequentially. The goal of concurrency is to interleave the execution of tasks so that the system can better respond to user requests, improving system throughput and response time.
- In general, parallelism focuses more on performance optimization and data-processing speed, while concurrency focuses more on the separation of tasks and the responsiveness of the system.

## Why use concurrency?

There are two main reasons for using concurrency in an application: `separation of concerns` and `performance`.

- Separation of concerns
  - **Concurrency can help break a complex application down into smaller, more independent parts, each focused on a specific task or function**. By dividing an application into multiple concurrently executing parts, the code can be better organized and managed, improving its readability and maintainability. Different tasks can execute in different threads or processes, independent of one another, thereby achieving separation of concerns. 
  - **In this case, the number of threads is independent of the number of available CPU cores, because the division into threads is based on the conceptual design rather than being done to increase throughput**.
- Performance optimization
  - **Concurrency can also be used to improve the performance of an application**. By executing multiple tasks concurrently, you can make full use of the resources of multi-core processors or distributed systems. This speeds up task processing and improves the system's responsiveness and throughput. For example, when processing large amounts of data concurrently or handling multiple user requests at the same time, executing tasks in parallel can significantly improve the application's performance.
  - **Dividing a single task into parts and running each in parallel, thereby reducing the total running time**, is called `task parallelism`. **Having each thread perform the same operation on different parts of the data** is called `data parallelism`.

Algorithms that are susceptible to this kind of parallelism are often called `embarrassingly parallel`. Despite the implication that you might be embarrassed that your code is so easy to parallelize, this is a good thing. I have come across other terms for such algorithms, such as `naturally parallel` and `conveniently concurrent`. `Embarrassingly parallel` algorithms have good scalability properties — as the number of available hardware threads increases, the parallelism in the algorithm can be increased to match. Such an algorithm is the perfect embodiment of the adage "many hands make light work." For the parts of an algorithm that are not embarrassingly parallel, you may be able to divide the algorithm into a fixed (and therefore not scalable) number of parallel tasks.

### When not to use concurrency

Knowing when not to use concurrency is just as important as knowing when to use it. Fundamentally, **the only reason not to use concurrency is when the benefit is not worth the cost**.

**Unless the potential performance gains are large enough or the separation of concerns is clear enough to justify the additional development time required to get parallelism right and the extra costs of maintaining multithreaded code, do not use concurrency**.

Of course, the performance gain from using concurrency may not be as large as you might expect; there is an inherent overhead in launching a thread, **because the operating system has to allocate the associated kernel resources and stack space and then add the new thread to the scheduler, all of which takes time. If the task being run on the thread is completed quickly, the time taken by the task may be dwarfed by the overhead of launching the thread, possibly making the overall performance of the application worse than if the task had been executed directly by the spawning thread**.

Furthermore, threads are a finite resource. If you have too many threads running at once, this consumes operating system resources and may make the system as a whole run slower. Not only that, but using too many threads can exhaust the available memory or address space of a process, because each thread requires a separate stack space.

Finally, the more threads you have running, the more context switches the operating system has to perform. **Each context switch takes time that could be spent doing useful work, so at some point adding an extra thread will actually reduce rather than increase the overall performance of the application**. For this reason, if you are trying to achieve the best possible performance of the system, it is necessary to adjust the number of threads running to take account of the available hardware concurrency (or lack of it).

Using concurrency for performance is like any other optimization strategy: **it has the potential to improve your application's performance greatly, but it can also complicate the code, making it harder to understand and more prone to bugs**.

## Concurrency and multithreading in C++

Standardized support for concurrency through multithreading is a relatively new thing for `c++`. It is only since the `c++11` standard that you have been able to write multithreaded code without resorting to platform-specific extensions.

### Efficiency in the C++ Thread Library

If you are after the utmost in performance, **it is important to understand the implementation costs associated with using any high-level facilities compared to using the underlying low-level facilities directly**. This cost is the `abstraction penalty`.

> Abstraction Penalty  
> **The abstraction penalty is the performance overhead incurred by using high-level facilities compared to using the underlying low-level facilities directly**. Encapsulated high-level facilities provide more convenient interfaces and abstraction layers, but may introduce additional overhead in the underlying implementation. This overhead may include resource consumption, extra function calls, memory allocation and deallocation, and so on. Therefore, when pursuing ultimate performance, you need to weigh the convenience brought by high-level facilities against the overhead of the abstraction layer and the underlying implementation.

The `C++ Standards Committee` was aware of this when designing the `C++ Standard Library` as a whole, and the `Standard C++ Thread Library` in particular. One of the design goals was that **there should be little or no benefit to be gained from using the lower-level APIs directly, where the same facility is to be provided**. The library has therefore been **designed to allow for an efficient implementation** (**with a very low abstraction penalty**) on most major platforms.

Another goal of the `C++ Standards Committee` has been to **ensure that C++ provides enough low-level facilities for those developers wishing to get close to the metal for the ultimate performance**. To this end, along with the new memory model comes a comprehensive atomic operations library for direct control over individual bits and bytes and the inter-thread synchronization and visibility of any changes. **These atomic types and the corresponding operations can now be used in many places where developers might previously have chosen to drop down to platform-specific assembly language**. Code using the new standard types and operations is more portable and easier to maintain.

**Sometimes, using these lower-level facilities may come with a performance cost because additional code must be executed. But this performance cost does not necessarily imply a higher abstraction penalty**. If you are after performance and the cost of using the high-level facilities is too high, you may be better off handcrafting the desired functionality from the lower-level facilities. In the vast majority of cases, the additional complexity and the chance of errors far outweigh the potential benefits from the small performance gain.

## Getting Started

Let's start with the most basic "Hello World" program as an example. Below is a single-threaded piece of code, which will serve as our baseline for converting it to multithreading later:

```cpp
#include <iostream>

int main() {
  std::cout << "Hello World\n";
}
```

Here is the multithreaded version of "Hello World":

```cpp
#include <iostream>
#include <thread>

void hello() {
  std::cout << "Hello Concurrency World\n";
}

int main() {
  std::thread t { hello };
  t.join();
}
```

The first thing we can notice is that there is an extra header, `<thread>`; this header contains the declarations of the functions and classes for managing threads, while the functions and classes for protecting shared data are declared in other headers.

Next, our print statement is placed in a separate function, `hello()`. This is because **every thread must have an initial function, from which the thread begins execution**. Therefore, the `hello()` function here serves as the initial function of thread `t`.

When our new thread starts, the initial thread (main) continues execution. If it does not wait for the new thread to finish, it will merrily continue to the end of `main()` and end the program — **possibly before the new thread has had a chance to run**. That is why we need to call `join()` after the statement that creates the new thread (this function will be explained in the second note).

And with that, a multithreaded "Hello World" is complete.
