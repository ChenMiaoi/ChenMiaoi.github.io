---
slug: Concurrency-in-Action-Managing-threads.en
title: 'Concurrency in Action: Managing threads'
lang: "en"
published: 2024-06-13
tags:
  - cpp
  - concurrency
category: books
series: concurrency-in-action
---
In the previous note, you learned what a thread is. In this installment, our main focus is: **how C++ launches threads, waits for threads to finish, and manages threads**.

## Basic thread management

Every $C++$ program has at least one thread, which is started by the $C++$ runtime to run `main()`. Your program can launch additional threads whose entry points you decide yourself. Now, let's look at how to start a new thread.

### Launching a thread

As you saw in the previous note, a thread starts when a `std::thread` object is constructed with the task it should run. In simple cases, the task is usually simple, with no parameters and no return value; it runs on its own in the newly spawned thread, and the thread terminates when it finishes. But in some extreme cases, the task can be a `function object` that requires specific additional arguments and performs a series of independent operations, which are specified at runtime through certain system messages, and the thread only stops when it receives a signal.

Either way, **for launching threads with the $C++$ Standard Library, everything starts with** `std::thread`.

```cpp
void do_some_work();
std::thread my_thread( do_some_work );
```

Of course, this is an extremely simple example. For `std::thread`, **it can accept any** `callable object type`, so passing an instance of a class that implements `operator()` to `std::thread` is feasible.

```cpp
class background_task {
public:
	void operator() () const {
		do_something();
		do_something_else();
	}
};

background_task f;
std::thread my_thread( f );
```

In this case, the supplied function object is **copied** into the memory belonging to the newly created thread and invoked there. Therefore, **the copy must behave the same as the original, otherwise the result may not be what you expect**.

One point is worth noting: when you pass a function object and that function object is a temporary value, $C++$ interprets it as a function declaration rather than an object definition. As shown below

```cpp
std::thread my_thread( background_task() ); // [Warning] Parentheses were disambiguated as a function declaration
```

This leads to the following interpretation: it declares a function taking a single parameter and returning a `std::thread` object, rather than launching a new thread. Therefore, there are two ways to solve this problem:

```cpp
std::thread my_thread( (background_task()) );
std::thread my_thread{ background_task() };
```

In the first approach, the extra parentheses prevent `my_thread` from being interpreted as a function declaration, allowing `my_thread` to be declared as a variable of type `std::thread`. The second approach uses the uniform initialization syntax from the $C++11$ standard (personally, I prefer this one).

There is another way to avoid the problem above when using function objects: use a `lambda expression`. This is a feature introduced in $C++11$ that allows you to write local functions that can capture local variables, which can avoid passing some extra arguments.

```cpp
std::thread my_thread ( [] {
    do_something();
    do_something_else();
} );
```

**Once you have started your thread, you must explicitly decide whether to wait for it to finish (join) or let it run on its own (detach). If you haven't settled how it runs before the thread finishes, your program will be forcibly terminated** (`std::tread` will call `std::terminate()`).

If you don't want to wait (join) for the thread to complete, you **need to ensure that the data the thread accesses remains valid until the thread finishes**. This is the same as in single-threaded programs: if you keep accessing an object after it has been destroyed, the result is undefined.

You may run into this problem: your thread function holds a pointer or reference to a local variable, and when the function exits, the thread has not finished yet. Here is an example

```cpp
struct func {
	int& _i;

	func(int& i): _i( i ) {}

	void operator() () {
		for (uint32_t j = 0; j < 100'0000; ++j) {
			do_something(_i);   // [Warning]: Potential access to dangling reference
		}
	}
};

void oops() {
	int some_local_state = 0;
	func my_func( some_local_state );
	std::thread my_thread( my_func );
	my_thread.detach();         // [Warning]: New thread might still be running
	                            // [Warning]: `some_local_state` destroyed
}
```

As you can see, in this example `my_thread` calls `detach()`, so the new thread is free to run; but the thread's activation function uses a reference to the local variable `some_local_state`. When execution leaves that scope, `some_local_state` is destroyed, so `do_something(_i)` in the thread may access undefined data. Here is a simple table to illustrate:

|            Main Thread             |                                  New Thread                                   |
|:----------------------------------:|:-----------------------------------------------------------------------------:|
| Construct `my_func` with a reference to `some_local_state` |                                                                               |
|           Create `my_thread`            |                                                                               |
|                                    |                                     Starts running                                      | 
|                                    |                             Calls `func::operator()`                              |
|           Detach `my_thread`            |                    Running `func::operator()`; calls `do_something()`                    | 
|        Destroy `some_local_state`        |                                     Still running                                      |
|             Exit the `oops` function             | Still running `func::opeartor()`; calls `do_something(some_local_state)` $\Rightarrow$ undefined behavior |

The most common way to handle this situation is to make the thread function self-contained and copy the data into the thread rather than using shared data. **Creating a thread inside a function that can access that function's local variables is a bad design, unless the thread is guaranteed to finish before the function exits**. Alternatively, you can use `join()` to ensure the thread function completes before the function exits.

### Waiting for a thread to complete

If you want to wait for a thread to complete, you should call the `join()` function on the corresponding thread instance. As in the example above, if you replace `detach()` with `join()`, the thread can finish before the function exits, so the local variable `some_local_state` is not destroyed, which makes it meaningful. Obviously, running the function on a separate thread makes little sense here, but in real code the original thread either has work to do, or launches several threads to do useful work before waiting for all of them to complete.

`join()` is a simple, brute-force solution — you either wait for the thread to finish or you don't. If you want some deeper, finer-grained control, such as checking whether a thread has completed or waiting only for a certain period of time, you can use the `condition variable` and `futures` mechanisms, which we will cover in the fourth note. Calling `join()` also **cleans up any storage associated with the thread instance**, so the thread is no longer associated with **any instance** of `std::thread`. This means that **for any given thread instance, `join()` can only be called once**; once you have called `join()`, that thread instance is no longer joinable, so `joinable()` should return $false$.

### Waiting in exceptional circumstances

Earlier we mentioned that you need to make sure `join()` or `detach()` is called before the `std::thread` instance is destroyed. If you want to detach the thread, you just call `detach()` right after starting it, which causes no problem. But if you want to wait for the thread, you need to choose carefully where to call `join()`. This means: **if an exception occurs after the thread is started but before the** `join()` **call, the** `join()` **call may be skipped, causing the program to terminate abnormally**.

Normally, if you want to avoid the situation above but still intend to call `join()` on the non-exceptional path, you should also call `join()` in the exception handler, implemented as follows:

```cpp
struct func;

void f() {
	int some_local_state = 0;
	func my_func( some_local_state );
	std::thread t( my_func );
	try {
		do_something_in_current_thread();
	} catch ( ... ) {
		t.join();
		throw ;
	}
	t.join();
}
```

The code above uses a `try/catch` block to ensure that the thread accessing local state finishes before the function exits, whether it exits normally or via an exception. However, **using `try/catch` blocks is verbose and prone to scope errors, so this is not the way we usually handle it**.

If ensuring the thread completes before the function exits is important, and whether it is because of references to local variables or any other reason, **it is crucial to make sure all possible exit paths achieve this goal**. Therefore, a simple, clean mechanism is needed to accomplish this.

One way to do this is to use the standard `Resource Acquisition Is Initialization (RAII)` idiom: provide a class that performs `join()` in its destructor, as shown below:

```cpp
class thread_guard {
    std::thread& _t;

public:
    explicit thread_guard(std::thread& t): _t( t ) {}
    ~thread_guard() {
        if (_t.joinable()) {
            _t.join();
	    }
    }

    thread_guard(const thread_guard&)               = delete;
    thread_guard& operator= (const thread_guard&)   = delete;
};

struct func;

void f() {
    int some_local_state = 0;
    func my_func( some_local_state );
    std::thread t( my_func );
    thread_guard g( t );
    do_something_in_current_thread();
}
```

When execution of the current thread reaches the end of `f()`, **local objects are destroyed in the reverse order of their construction**. Therefore, the `thread_guard` instance is destroyed first, so `g` calls its destructor, which makes the `join()` call inside it — even if the function exits via an exception, leaving the function scope still triggers the destructor call.

The destructor of `thread_guard` first checks whether the thread instance can be waited on (`joinable()`); since `join()` itself can only be called once, this check prevents a duplicate `join()`. The copy constructor and copy assignment are explicitly marked `delete` to prevent the compiler from automatically providing copy semantics. **If copying were allowed, the object could escape the scope the thread is supposed to be confined to**.

If you don't need to wait for the thread to finish, you can avoid this exception-safety problem by detaching the thread. This breaks the association between the thread and the `std::thread` object, and ensures that `std::terminate()` is not called when the `std::thread` object is destroyed, even though the thread is still running in the background.

### Running threads in the background

Calling `detach()` on a thread object leaves the thread running in the background, with no direct means of communicating with it afterwards; and it is no longer possible to wait for it to complete. **Its ownership and control are handed over to the $C++$ runtime, which ensures that the resources associated with the thread are correctly reclaimed when it exits.**

Corresponding to the $Unix$ `daemon process`, detached threads are usually called `daemon threads`: they run in the background without any explicit user interface. These threads are all long-running — they run for almost the entire lifetime of the application, performing background tasks such as monitoring the file system, clearing unused cache entries, or optimizing data structures.

At the other extreme, using detached threads makes sense when there is another mechanism to identify when the thread has finished, or where the thread is used for a `fire-and-forget task`.

> Fire-And-Forget task  
> This term is usually used to describe a way of executing tasks, especially in computer science and engineering. "Fire-and-forget" means that after the initiator starts a task, it no longer needs to pay attention to the task's result or status and can continue executing other tasks. 
> In computer programming, "fire-and-forget" can be used to describe a style of asynchronous operation. When a program executes a "fire-and-forget" task, it triggers an operation but does not wait for that operation to complete or return a result. Instead, the program continues executing subsequent code without being blocked by the task's execution. 
> This approach is often used for tasks whose results are not needed immediately or require no further processing. For example, when sending email, you can use the "fire-and-forget" pattern: add the email to a send queue and return to the user interface immediately, without waiting for all emails to be sent successfully.

As you saw in the earlier example, once a thread is detached, that thread instance can no longer be waited on.

```cpp
std::thread t( do_background_task );
t.detach();
assert( !t.joinable() );
```

Also note that **you can use** `joinable()` **to check whether an instance object can be** `join()`**ed or** `detach()`**ed**.

Now consider an application, such as a text editor that can edit multiple documents at the same time. There are many ways to implement this, whether from the $UI$ level or internally. One increasingly common approach is to use multiple independent top-level windows, one for each document being edited. Although these windows look completely independent and have their own menu bars, they actually run within the same instance of the application. Another way to handle this is for each document-editing window to be a thread; each thread runs the same code, differing only in the document being edited and the data related to the corresponding window properties. Opening a new document creates a new thread. The thread handling the request doesn't care about waiting for another thread to finish, because it is working on an unrelated document, which makes it a prime candidate for running as a detached thread.

Here is a simple outline of the implementation:

```cpp
void edit_document( const std::string& filename ) {
    open_document_and_display_gui( filename );
    while ( !done_editing() ) {
        user_command cmd = get_user_input();
        if ( cmd.type == open_new_document ) {
            const std::string new_name = get_filename_from_user();
            std::thread t( edit_document, new_name );
            t.detach();
        } else {
            process_user_input( cmd );
        }
    }
}
```

## Passing arguments to a thread function

As we saw in the examples above, passing additional arguments to the `std::thread` constructor is essentially as simple as passing arguments to a callable object or function. But the most important point is: **by default, the arguments are copied into internal storage (as rvalues), where they can be accessed and used by the new thread of execution, and are then passed as arguments to the callable object or function in the form of** `rvalue`s.

```cpp
void f( int i, const std::string& s );
std::thread( f, 3, "hello" ); 
```

It's worth noting that **although** `f`**'s second parameter takes the form** `const std::string&`, **the string literal is passed as a** `const char*` **and is only converted to** `std::string` **in the context of the new thread**.

```cpp
void f( int i, const std::string& s );

void oops( int some_param ) {
	char buffer[1024];
	sprintf(buffer, "%i", some_param);
	std::thread t( f, 3, buffer );  // [Warning]: it might be dangling pointer
	t.detach();
}
```

In this example, `buffer` is a pointer to a local variable that is passed to the new thread. **Before it is converted to** `std::string` **on the new thread, the** `oops` **function may exit, leading to undefined behavior**. Therefore, converting `buffer` to `std::string` before passing it in solves the problem.

```cpp
void f( int i, const std::string& s );

void not_oops( int some_param ) {
	char buffer[1024];
	sprintf(buffer, "%i", some_param);
	std::thread t( f, 3, std::string( buffer ) );   // Using std::string avoids dangling pointer
	                                                // [Warning]: convert too late
	t.detach();
}
```

In this example, we try to explicitly convert `buffer` to the corresponding type ahead of time, **but this conversion may happen too late, so the expected type and result may not be produced**.

Now consider this case: the argument is copied, but you want a `non-const` reference. This is not possible and will cause a compilation error. As shown below:

```cpp
void update_data_for_widget( widget_id w, widget_data& data );
void oops_again( widget_id w ) {
	widget_data data;
	// [Error]: std::thread arguments must be invocable after conversion to rvalues
	std::thread t ( update_data_for_widget, w, data );   
	display_status();
	t.join();
	process_widget_data( data ); 
}
```

Although the second parameter of `update_data_for_widget` expects a reference to `widget_data`, the `std::thread` constructor doesn't know that type; **because it ignores the expected parameter types and just blindly copies the arguments over. Moreover, its internal implementation only passes them on as rvalues, because the entire** `std::thread` **constructor is set up for rvalues**. This causes a compilation error, because you **cannot pass an rvalue to a** `non-const` **type**. If you are familiar with `std::bind`, it's easy to see that we need to wrap this argument with `std::ref` to make it a reference.

```cpp
std::thread t ( update_data_for_widget, w, std::ref( data ) );
```

After this change, the code compiles successfully and passes a reference argument into the function.

If you are familiar with `std::bind`, the argument-passing semantics of `std::thread` are not hard to understand, because the `std::thread` **constructor and** `std::bind` **work by the same mechanism**. This means you can pass a member function pointer as the function, together with a suitable object pointer as the first argument:

```cpp
class X {
public:
    void do_lengthy_work();
};

X my_x;
std::thread t ( &X::do_lengthy_work, &my_x );
```

The code above calls `my_x.do_lengthy_work()` on the new thread, because the address of `my_x` is supplied as the object pointer to the thread constructor. You can also supply arguments for the member function: the third argument of the constructor becomes the member function's first argument, and so on.

Another interesting case of supplying arguments is when **the argument cannot be copied, only** `move`d. One example of such a type is `std::unique`, which provides automatic memory management for dynamically allocated objects. Only one `std::unique` instance points to a given object at a time, and when that instance is destroyed, the object it points to is deleted. The `move constructor` and `move assignment operator` allow ownership of the object to be transferred between `std::unique` instances. If it is a temporary object, the move happens automatically; if it is a named object, you need to explicitly request move semantics via `std::move`.

```cpp
void process_big_object( std::unique_ptr< big_object > );
std::unique_ptr< big_object > p ( new big_object );
p->prepare_data( 42 );
std::thread t ( process_big_object, std::move(p) );
```

**This ownership can be transferred between instances**, because `std::thread` **instances are movable even though they are not copyable. This ensures that at any time only one object is associated with a particular thread of execution, while allowing us to choose to transfer that ownership between objects**.

## Transferring ownership of a thread

Suppose you want to write a function that creates a thread to run in the background, but hands ownership of the new thread back to the calling function rather than waiting for it to complete; or you might want the opposite: create a thread and pass ownership to some function that should wait for it to complete. In either case, you need to transfer ownership from one place to another.

This is where `std::thread`'s support for move semantics comes in. It means ownership of a thread of execution can be moved between `std::thread` instances. The following example creates two threads of execution and transfers ownership of these threads among three `std::thread` instances, `t1`, `t2`, and `t3`:

```cpp
void some_function();
void some_other_function();
std::thread t1( some_function );
std::thread t2 = std::move( t1 );
t1 = std::thread( some_other_function );
std::thread t3;
t3 = std::move( t2 );
t1 = std::move( t3 );   // [Warning]: This assignment will terminate the program!
```

Before `t1 = std::move( t3 )` is executed, we can see ownership of the thread instances being passed around among them, and that all works fine. However, when `t1 = std::move( t3 )` executes, we can see that `t1` is already associated with a thread instance; when we move `t3`'s ownership into `t1`, the resource `t1` originally managed would be lost without a `join()` or `detach()`, so `std::terminate()` is called. This is done to keep `std::thread` destruction consistent: **you cannot destroy a thread by assigning a new value to the** `std::thread` **object that manages it**.

The fact that `std::thread` supports move semantics means that **ownership can easily be transferred out of a function**, as in this example:

```cpp
std::thread f() {
	void some_function();
	return std::thread( some_function );
}

std::thread g() {
	void some_other_function( int );
	std::thread t( some_other_function, 42 );
	return t;
}
```

Likewise, if ownership needs to be transferred into a function, it can take a `std::thread` parameter by value, as shown below:

```cpp
void f( std::thread t );
void g() {
	void some_function();
	f( std::thread( some_function ) );
	std::thread t( some_function );
	f( std::move( t ) );
}
```

One benefit of `std::thread` supporting move semantics is that **code that needs it can acquire its ownership**. For example, we can build on the `thread_guard` class we created earlier.

```cpp
class scoped_thread {
	std::thread _t;

public:
	explicit scoped_thread( std::thread t ): _t( std::move(t) ) {
		if ( !t.joinable() )
			throw std::logic_error( "No thread" );
	}
	~scoped_thread() {
		_t.join();
	}
	scoped_thread( const scoped_thread& ) = delete;
	scoped_thread& operator= ( const scoped_thread& ) = delete;
};

struct func;
void f() {
	int some_local_state;
	scoped_thread t { std::thread( func( some_local_state ) ) };
	do_something_in_current_thread();
}
```

This example is similar to `thread_guard`, but the new thread is passed directly to `scoped_thread` without creating a separate named variable. Also, when the `scoped_thread` is destroyed, there is no need to check whether the thread is joinable — it just calls `join()` directly.

There was a proposal in `C++17` called `joining_thread`, similar to `std::thread` but automatically calling `join()` in its destructor like `scoped_thread`. That proposal was not accepted by the standards committee; instead, it appeared in `C++20` as `std::jthread`. A possible implementation is given below:

```cpp
class joining_thread {
	std::thread _t;

public:
	joining_thread() noexcept = default;

	template < typename Callable, typename ... Args >
	explicit joining_thread(Callable&& func, Args&& ... args)
		: _t(std::forward< Callable >(func), std::forward< Args >(args)...) { }

	explicit joining_thread(std::thread t) noexcept
		: _t(std::move(t)) { }

	joining_thread(joining_thread&& rhs) noexcept
		: _t(std::move(rhs._t)) { }

	joining_thread& operator=(joining_thread&& rhs) noexcept {
		if ( joinable()) join();
		_t = std::move(rhs._t);
		return *this;
	}

	joining_thread& operator=(std::thread other) noexcept {
		if ( joinable()) join();
		_t = std::move(other);
		return *this;
	}

	~joining_thread() noexcept {
		if ( joinable()) join();
	}

public:
	void swap(joining_thread& other) noexcept { _t.swap(other._t); }
	bool joinable() const noexcept { return _t.joinable(); }
	void join() { _t.join(); }
	void detach() { _t.detach(); }
	std::thread& as_thread() noexcept { return _t; }
	const std::thread& as_thread() const noexcept { return _t; }
};
```

Support for `std::thread` move semantics also allows containers of `std::thread` objects, such as the move-aware `std::vector`.

```cpp
void do_work(int id);
void f() {
    std::vector<std::thread> threads;
    for (int i = 0; i < 20; i++) {
        threads.emplace_back(do_work, i);   // Spawns threads
    }
    for (auto& entry : threads) 
        entry.join();
}
```

If threads are used to divide up the work of an algorithm, one condition usually must hold: **all threads must have completed before returning to the caller**. The simple structure of the code above means the work done by the threads is self-contained, and the results of their operations are purely side effects on shared data. If the `f()` **function needs to return a value to its caller that depends on the results of these threads' operations, then as currently written, that return value must be determined by examining the shared data after the threads have terminated**. In the fourth note, we will discuss other schemes for transferring the results of operations between threads.

Putting `std::thread` objects in a `std::vector` is a step toward automating the management of those threads: **rather than creating separate variables for these threads and joining with them directly, you can treat them as a group**. You can go a step further and create a dynamic number of threads at runtime instead of a fixed number.

## Choosing the number of threads at runtime

One useful feature of the $C++$ Standard Library is [std::thread::hardware_concurrency()](https://en.cppreference.com/w/cpp/thread/thread/hardware_concurrency). This function returns an indication of **the number of threads that can truly run concurrently for a given program execution**. On a multicore system, this number might be the number of $CPU$ cores.

The following code example shows an implementation of a simple parallelized version of [std::accumulate()](https://en.cppreference.com/w/cpp/algorithm/accumulate). In practice, you might also want to use the parallelized `std::reduce` algorithm rather than implementing your own; that will be covered in the tenth note. In the example below, it divides up the number of tasks per thread so that each thread performs a smaller number of tasks, to avoid excessive overhead.

```cpp
template < typename Iterator, typename T >
struct accumulate_block {
	void operator() ( Iterator first, Iterator last, T& result ) {
		result = std::accumulate( first, last, result );
	}
};

template < typename Iterator, typename T >
T parallel_accumulate( Iterator first, Iterator last, T init ) {
	const uint64_t length = std::distance( first, last );
	if ( !length ) return init;
	const uint64_t min_per_thread = 25;
	const uint64_t max_threads = ( length + min_per_thread - 1 ) / min_per_thread;
	const uint64_t hardware_threads = std::thread::hardware_concurrency();
	const uint64_t num_threads = std::min(
		hardware_threads != 0 ? hardware_threads : 2,
		max_threads );
	const uint64_t block_size = length / num_threads;

	std::vector< T > results( num_threads );
	std::vector< std::thread > threads( num_threads - 1 );
	Iterator block_start = first;
	for (uint64_t i = 0; i < num_threads - 1; i++) {
		Iterator block_end = block_start;
		std::advance( block_end, block_size );
		threads[i] = std::thread{
			accumulate_block< Iterator, T > (),
			block_start, block_end, std::ref( results[i] )
		};
		block_start = block_end;
	}
	accumulate_block< Iterator, T >() (
		block_start, last, results[num_threads - 1]
	);
	for (auto& thread : threads) thread.join();

	return std::accumulate(results.begin(), results.end(), init);
}
```

Although this code looks long, it's actually simple and easy to understand. Suppose your machine has $32$ cores.

- First, determine the maximum number of threads the task requires
  - **If the input range is empty, the initial value supplied as the** `init` **parameter should be returned as the return value**.
  - Otherwise, as long as there is at least one element in the `range`, you can divide the number of elements to process by `block_size` to get the maximum number of threads needed, `max_threads` (this step avoids creating too many thread resources).
- Second, calculate the number of threads that will actually run
  - We don't want to run more threads than the hardware can support (this is called `oversubscription`), because context switching means more threads will degrade performance.
  - If `std::thread::hardware_concurrency()` returns $0$, use a value of your own choosing as a substitute; here the substitute is $2$
  - Otherwise, take the minimum of the actual hardware thread count and the maximum thread count we obtained, giving the actual number of threads to run, `num_threads` (**because too many threads degrades performance on a single core, while too few cannot achieve parallelization**)
- Third, calculate the number of tasks each thread should perform
  - The number of entries each thread has to process — `block_size` — is the length of the task range divided by the number of threads actually running.
- Fourth, create space for the threads and for storing the results
  - Now that you have computed the actual number of threads to run and the number of tasks each thread will perform, you should allocate the corresponding resources
  - `std::vector< T > results` is where each thread's result is stored
  - `std::vector< std::thread > threads` is the container that runs and manages each thread (**you need to create one fewer slot than the actual number of running threads we computed, because the calling thread can also participate in the computation**)
- Fifth, divide up the task block each thread needs to compute
  - A simple loop divides up the range $[first, last)$ that each thread executes over
  - `std::advance( block_end, block_size )` and `block_start = block_end;` are the main logic for delimiting each task block; `accumulate_block< Iterator, T > ()` is the actual logic each thread runs
- Sixth, accumulate all the results
  - `results` holds the result each thread computed for its corresponding task block; `std::accumulate(results.begin(), results.end(), init)` produces the final result

There are a few more points to note here: **the iterator must be at least a** `forward iterator`, and **`T` must be default-constructible** so that `results` can be created. Also, **we cannot return a value directly from a thread** — this will be solved with `future` in the fourth note. In the eighth note, I will analyze parallel algorithms in depth; and in the tenth note, I will introduce the parallel algorithms in the $C++17$ Standard Library.

In this example, all the data is passed in when the threads are initialized (including where the computation results should be stored). In practice, though, there is always some data that can only be determined at runtime — for example, we might need to locate a particular thread and find out which level of the call stack it is on. For this reason, in the design of the $C++$ Standard Library, every thread has a unique identifier.

## Identifying threads

The type of a thread identifier is [std::thread::id](https://en.cppreference.com/w/cpp/thread/thread/id), and there are two ways to obtain one. First, a thread identifier can be obtained from its associated thread object by calling [get_id()](https://en.cppreference.com/w/cpp/thread/thread/get_id); the other way is to use [std::this_thread::get_id()](https://en.cppreference.com/w/cpp/thread/get_id) to get the thread identifier of the **current thread**.

Instances of `std::thread::id` **can be freely copied and compared** — otherwise they'd be of little use. If two instances are equal, it identifies that they are the same thread or both hold the `not any thread` value.

The $C++$ Standard Library **not only doesn't limit you to checking whether thread identifiers are the same, but objects of type** `std::thread::id` **provide the full set of comparison operators, giving a total ordering over all distinct values**. This allows them to be used as keys in associative containers, or sorted, or compared in any other way you see fit. **The comparison operators provide a total order for all unequal** `std::thread::id` **values**, so they behave as you would intuitively expect: **if $a \lt b$ and $b \lt c$, then $a \lt c$, and so on**. The Standard Library also provides [std::hash< std::thread::id >](https://en.cppreference.com/w/cpp/thread/thread/id/hash), **so that values of type** `std::thread::id` **can also be used as keys in the new unordered associative containers**.

Instances of `std::thread::id` **are often used to check whether a thread needs to perform certain operations**, as shown in the following example:

```cpp
std::thread::id master_thread;
void some_core_part_of_algorithm() {
	if ( std::this_thread::get_id() == master_thread ) {
		do_master_thread_work();
	}
	do_common_thread_work();
}
```

In addition, the current thread's `std::thread::id` can be stored in a data structure as part of an operation. Subsequent operations on the same data structure can then check the relationship between the stored thread $id$ and the $id$ of the thread performing the operation, to determine which operations are allowed (or required).

Similarly, **thread $id$s can be used as keys in associative containers to associate specific data with a thread where other mechanisms, such as thread-local storage, are not appropriate. Such a container could be used by a controlling thread to store information about each of the threads under its control, or to pass information between threads**.
