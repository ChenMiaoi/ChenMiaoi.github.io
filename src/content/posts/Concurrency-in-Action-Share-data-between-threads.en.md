---
slug: Concurrency-in-Action-Share-data-between-threads.en
title: 'Concurrency in Action: Share data between threads'
published: 2024-06-15
tags:
  - cpp
  - concurrency
category: books
series: concurrency-in-action
lang: "en"
---
**One potential benefit of using threads to implement concurrency is that data can be shared between them easily and directly**. Therefore, this note discusses some of the issues surrounding shared data.

If you share data between threads, you need to **define which thread can access which data and when, as well as how any updates are communicated to the other threads that care about that data**. However, incorrect use of shared data is the single biggest cause of threading-related $BUG$s.

This note is **about safely sharing data between threads in $c++$, avoiding the potential problems that may arise, and maximizing the benefits**.

## Problems with sharing data between threads

When we talk about this, all the problems with shared data are caused by threads modifying the data. **If all shared data is read-only, no problems will occur, because one thread reading the data is not affected by another thread reading the same data**. But if one or more threads start modifying the data, many problems can arise.

One widespread concept is the `invariant` — a statement about a particular data structure that is always true. These invariants are often broken during updates, especially when the data structure is very complex or the update requires modifying multiple values.

Now consider a doubly linked list, in which every node contains a pointer to the next node and a pointer to the previous node in the list. One of its invariants is: if you follow the `next` pointer from one node ($A$) to the next node ($B$), then the `prev` pointer of node ($B$) points back to the previous node ($A$). If we want to remove a node, the nodes on either side must be updated to point to each other; as soon as the pointer on one side has been changed, the invariant is broken, and it is not re-established until the other side has been changed accordingly.

Here is an explanation of each step in the figure below:

a. Identify the node $N$ to be deleted
b. Update the node before $N$ to point to the node after $N$
c. Update the node after $N$ to point to the node before $N$
d. Delete node $N$

![Deleting a node from a doubly linked list](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202406161236186.png)

As we can see, between steps $b$ and $c$, the invariant is broken because the linkage in one direction is inconsistent with the linkage in the other direction.

**The simplest potential problem when modifying data shared between threads is a broken invariant**. If one thread is reading this doubly linked list while another is deleting a node from it, the reading thread is very likely to see the list partway through the deletion, so the invariant is broken. And depending on which stage of the deletion the reading thread sees, the final outcome will differ.

- If the reading thread reads from left to right, it may simply skip the deleted node $N$
- If the deleting thread happens to delete the rightmost node, it may permanently corrupt the structure of the list and eventually cause the program to crash

This raises yet another problem, one of the most common causes of $bug$s in concurrent code: the `race condition`.

### Race Condition

Suppose you want to buy a movie ticket at a cinema, and there are multiple windows handling purchases. If you have just told the cashier what you want, and another person at another window happens to be buying the same seat, then whether you successfully get the seat you want depends on whether your booking or theirs goes through first. This is an example of a `race condition`.

**In concurrency, a race condition is any situation in which the outcome depends on the relative order in which operations on two or more threads are executed**; the threads race to perform their respective operations. In most cases, race conditions are benign; however, **once a race condition causes an invariant to be broken, problems can occur**. When we discuss race conditions, the term `race condition` usually refers to a `problematic race condition`. The $c++$ standard also specifically uses `data race` for the particular type of race condition caused by concurrently modifying the data of a single object, and a `data race` produces undefined behavior.

A `problematic race condition` typically **occurs when completing an operation requires modifying two or more distinct pieces of data**. **Race conditions are usually hard to find and reproduce, because the chance of them occurring is small**. **If the modification is performed as consecutive $CPU$ instructions, the probability of the problem appearing on any given run is small, even while the data structure is being accessed concurrently by another thread. As the system load increases and the operation is performed more times, the likelihood of the problem appearing also increases. Such problems tend to show up at the most inconvenient times, almost inevitably. Because race conditions are usually time-dependent, they often disappear completely when the application runs under a debugger, since the debugger affects the program's timing, even if only slightly**.

Therefore, knowing how to avoid race conditions in multithreaded code is a must.

### Avoiding problematic race condition

There are many ways to deal with problematic race conditions. The simplest one is to **wrap the data structure with a protection mechanism that ensures only the thread performing the modification can see the intermediate states in which the invariant is broken**. From the point of view of other threads accessing that data structure: **the modification either has not started yet or has already completed**. For this purpose, the $c++$ standard library provides many mechanisms (which will be covered in this note).

Another option is to **modify the design of the data structure and its invariants so that modifications are performed as a series of indivisible changes, each of which preserves the invariants**. This is known as `lock-free programming`, but it is often very hard to do. If you work at this level, **the subtleties of the memory model and the question of which threads may see which values can become complicated**. The memory model is covered in detail in the fifth note of this series, and lock-free programming is discussed in the seventh.

Another way to handle race conditions is to treat updates to the data structure as a `transaction`, just as updates to a database are performed within transactions. In this area there is a term called `STM(software transactional memory)`, a concurrent programming model that **aims to simplify shared-memory access and synchronization in multithreaded programs. It provides a mechanism similar to database transactions, allowing developers to define a series of atomic operations that either all execute successfully or are all rolled back, like a single indivisible transaction**. For the time being, however, it will not be covered further in this series of notes.

The most common way of protecting shared data in the $c++$ standard library is the `mutex`.

## Protecting shared data with mutexes

If you have a shared data structure, such as the doubly linked list mentioned earlier, and you want to protect it from race conditions and the broken-invariant problems they may cause, then mark all the code that accesses that data structure as `mutually exclusive`. This ensures that **when one thread is executing, any other thread that tries to access the data structure must wait until that thread has finished. This makes it impossible for threads other than the one making the modification to see the broken invariant; only the thread performing the modification can see it**.

For this you can use the `mutex`, a synchronization primitive provided by $c++$. Before accessing the shared data you first lock the `mutex`, and when you have finished accessing it or performing other operations, you unlock the `mutex`. The thread library then ensures that once one thread has locked a particular mutex, all other threads that try to lock the same mutex must wait until the thread that successfully locked it unlocks it. This ensures that all threads see a consistent view of the data.

Of course, in most cases mutexes can solve many problems, but they are by no means the only option, and in a few extreme cases a mutex is not a silver bullet: it can itself give rise to `deadlock` problems.

### Using mutexes in C++

In $c++$, you can create a mutex by constructing an instance of [std::mutex](https://en.cppreference.com/w/cpp/thread/mutex), lock it with [lock()](https://en.cppreference.com/w/cpp/thread/mutex/lock), and unlock it with [unlock()](https://en.cppreference.com/w/cpp/thread/mutex/unlock). In practice, calling `lock()` and `unlock()` manually is not recommended. $c++$ also provides the [std::lock_guard](https://en.cppreference.com/w/cpp/thread/lock_guard) class template, which implements `RAII`: it locks the supplied mutex on construction and unlocks it on destruction, ensuring that a locked mutex is always unlocked correctly.

```cpp
#include <list>
#include <mutex>

std::list< int32_t > some_list;
std::mutex some_mutex;
void add_to_list(int new_value) {
	std::lock_guard< std::mutex > guard( some_mutex );
	some_list.push_back( new_value );
}

bool list_contains(int value_to_find) {
	std::lock_guard< std::mutex > guard( some_mutex );
	return std::find(
		some_list.begin(),
		some_list.end(),
		value_to_find ) != some_list.end();
}
```

As you can see from the example above, the two functions `add_to_list` and `list_contains` are mutually exclusive, which means `list_contains` will never access the data structure partway through a modification by `add_to_list`. In the $c++17$ standard, thanks to $CTAD$, we can simply omit the explicit declaration of the template argument.

```cpp
std::lock_guard guard( some_mutex );
```

The $c++17$ standard also added an enhanced version of the `lock guard` class, [std::scoped_lock](https://en.cppreference.com/w/cpp/thread/scoped_lock), which of course can also omit the template declaration via $CTAD$.

```cpp
std::scoped_lock guard( some_mutex );
```

> CTAD, Class Template Argument Deduction  
> A feature introduced in C++17. It allows you to omit template arguments when using class templates; the compiler automatically deduces the template arguments from the context of the function call or object creation. The introduction of CTAD simplifies the use and writing of templates, making the code more concise and readable. It is worth noting that **$CTAD$ only applies in certain specific contexts and forms of initialization — template arguments cannot be omitted in every situation**.

For the simplicity and compatibility of these notes, the code examples here still use `std::lock_guard`.

Although using global variables is appropriate in some cases, in most cases **it is usual to group the mutex together with the protected data in a class rather than use global variables**. This conforms to $OOP$ design principles. However, some sharp-eyed readers will notice that **if a member function returns a pointer or reference to the protected data, then it doesn't matter that all member functions lock the mutex in a nice, orderly fashion, because you have just punched a big hole in the protection**. ***Any code with access to that pointer or reference can access (and potentially modify) the protected data without locking the mutex***. Therefore, protecting data with a mutex requires careful interface design to ensure that the mutex is locked before any access to the protected data and that there are no back doors.

### Structuring code for protecting shared data

As you can see, protecting shared data with a mutex is not as simple as adding a `std::lock_guard` to every function; **one stray pointer or reference, and all the protection work goes to waste**. In one respect, checking for stray pointers or references is relatively easy; **you only need to make sure the corresponding member functions do not return a pointer or reference to the protected data, and do not pass one out through an **`out`** parameter**. If you think a little deeper, you will know that nothing is ever that easy. **In addition to checking that member functions do not pass pointers or references to their callers, it is equally important to check that they do not pass such pointers or references to functions they call that are not under your control, because those functions might not use the protected data immediately but instead store it away for later use without the protection of the mutex**. Here is an example:

```cpp
class some_data {
	int32_t _a;
	std::string _b;

public:
	void do_something() {}
};

class data_wrapper {
	some_data _data;
	std::mutex _mtx;

public:
	template < typename Function >
	void process_data(Function func) {
		std::lock_guard< std::mutex > lock( _mtx );
		func( _data );	// Pass “protected” data to user-supplied function
	}
};

some_data* unprotected;
void malicious_function(some_data& protect_data) {
	unprotected = &protect_data;
}

data_wrapper x;
void foo() {
	x.process_data(malicious_function );	// [Warning]: Pass in a malicious function
	unprotected->do_something(); // [Warning]: Unprotected access to protected data
}
```

In this example, `process_data` looks safe enough and is well protected by `std::lock_guard`. However, it calls a user-supplied function `func`, which means the data can be passed to `malicious_function`, and `do_something()` can then be called without any protection at all.

Fundamentally, the problem with this code is that it fails to do what you set out to do: **mark *all* the pieces of code that access the data structure as mutually exclusive**. In other words, it misses the protection of `unprotected->do_something()` in this example, and worse still, the $c++$ **standard library does not provide any protection mechanism against this behavior**.

Therefore, **do not pass pointers or references to protected data outside the scope of the mutex, whether by returning them from a function, storing them in externally visible memory, or passing them as arguments to user-supplied functions**.

### Spotting race condition inherent in interface

**Just because you are using a mutex to protect shared data does not mean you are now immune to race conditions. You still need to make sure the data is actually protected**. Take the deletion operation on the doubly linked list from earlier: to let a thread safely delete a node, we might try to protect the node to be deleted along with the nodes on either side of it. However, a race condition can still occur, because you are only protecting each node individually rather than protecting the deletion operation as a whole. In this case, the simplest approach, as shown before, is to protect the entire list with a single mutex.

**But just because individual operations on the list are protected, you are not truly out of danger yet; race conditions can still occur**. Consider a stack data structure, such as the `stack` adapter. If you modify `top()` **so that it returns a copy rather than a reference, and protect the internal data with a mutex**, this interface is still subject to race conditions. This problem is not unique to mutex-based implementations; it is an interface problem, so race conditions can still occur in a lock-free implementation.

```cpp
template < typename T, typename Container = std::deque< T > >
struct stack {
public:
	explicit stack( const Container& );
	explicit stack( Container&& = Container() );

	template < typename Alloc > explicit stack( const Alloc& );
	template < typename Alloc > stack( const Container&, const Alloc& );
	template < typename Alloc > stack( Container&&, const Alloc& );
	template < typename Alloc > stack( stack&&, const Alloc& );

	bool 	    empty() const;
	size_t 		size() const;
	T& 			top();
	const T&	top() const;
	void 		push( const T& );
	void 		push( T&& );
	void 		swap( stack&& );

	template < typename ... Args > void emplace( Args&& ... args );
};
```

The problem here is mainly that the results of `empty()` and `size()` can no longer be relied upon. Although they may be correct at the time of the call, once they return, other threads are free to access the stack and may `push()` new elements onto it or `pop()` existing elements off it before the thread that called `empty()` or `size()` uses that information.

In particular, if the stack instance is not shared, it is safe to check `empty()` and then call `top()` to access the top element if the stack is not empty.

```cpp
stack< int32_t > s;
if ( s.empty() ) {
    const int32_t value = s.top();
    s.pop();
    do_something( value ); 
}
```

Obviously, this code is always safe on a single thread. With multiple threads, this code is no longer safe, because it is entirely possible that while the current thread is between the calls to `empty()` and `top()`, another thread calls `pop()` and removes the last element from the stack, which leads to undefined behavior. Therefore, **using a mutex internally does not guarantee correct behavior either**.

So how do we solve this? In the simplest case, when the stack contains no elements, you can make the implementation of `top()` throw an exception internally if it is called at that point. Although this directly solves the problem, we then have to catch the exception on the outside, which is obviously cumbersome. An optimization for the `empty()` call then becomes necessary (though, of course, it is not strictly required).

If you look carefully, you will also notice that in the code snippet above there is also a race condition between `top()` and `pop()`. Let us consider the situation where you have two threads referring to the same stack object `s`. Suppose the stack starts with two elements; then you do not need to worry about a problem between `empty()` and `top()`.

If the stack is protected by a mutex so that only one thread at a time can enter and execute its internal functions, these calls can interleave normally. However, the calls to `do_something` run concurrently.

|           Thread A            |           Thread B            |
|:-----------------------------:|:-----------------------------:|
|        if (!e.empty())        |                               | 
|                               |        if (!e.empty())        |
| const int32_t value = s.top() |                               |
|                               | const int32_t value = s.top() |
|            s.pop()            |                               |
|                               |            s.pop()            |
|     do_something( value )     |                               |
|                               |     do_something( value )     |

As you can see, if only two threads are running, there is no gap between the two calls to `top()`, so the `value` in both threads sees the same piece of data. Not only that, there is also no call to `pop()` between these two calls to `top()`. As a result, **one value will be discarded without ever being read, while the other value will be used twice**. As you can see, this is where another race condition lurks, one far more insidious than the undefined behavior caused by `empty()` and `top()`; more importantly, there is no obvious error here, and the consequences and cause of the error may also depend on what `do_something()` actually does.

This calls for a more radical change to the interface: combining the calls to `top()` and `pop()` under the protection of the mutex. However, it has been pointed out that **if the copy constructor of the objects on the stack can throw an exception, the combined call can cause problems**.

We now explain this problem with `stack< vector< int32_t > >`. A `vector` is a dynamically sized container, so when you intend to copy a `vector`, the standard library needs to allocate space on the heap to copy its data. If the system is heavily loaded or under significant resource constraints, this memory allocation may fail, so the `vector`'s copy constructor may throw a `std::bad_alloc` exception. If `pop()` is implemented to return the popped value and remove it from the stack, you run into a potential problem: **the popped value is returned to the caller only after the stack has already been modified, but an exception may be thrown while the data is being copied to the caller**. If this happens, the value has indeed been popped and removed, yet its copy failed. Therefore, when designing this interface, `stack` splits it into two steps:

- Get the top element (`top()`)
- Remove that element (`pop()`)

Therefore, if you cannot copy the data safely, the data still stays on the stack. But it is worth noting that if you need to eliminate the race, this kind of split should not occur.

#### Option1: Pass In A Reference

The first solution: when you want to retrieve the popped value, pass a reference as the argument to `pop()` to receive the value.

```cpp
std::vector< int32_t > result;
some_stack.pop( result );
```

This works well in many cases, but it has an obvious drawback: **it requires the calling code to construct an instance of the stack's value type before the call, in order to pass it in as the target**. For some types this is impractical, because constructing an instance is very expensive in terms of time or resources. For other types it is not always feasible either, because the arguments required by the constructor may not be available at this point in the code. Finally, it requires the stored type to be assignable. This is an important restriction: **many user-defined types do not support assignment, even though they may support move construction or even copy construction (and thus allow return by value)**.

#### Option2: Require A No-Throw Copy Constructor Or Move Constructor
