---
title: 'Concurrency in Action: Managing threads'
mathjax: true
date: 2024-06-13 16:50:43
tags: [cpp, concurrency]
categories: [books]
---

# Managing Threads

在上一篇笔记中，你已经了解了什么是线程，那么这一讲我们主要关注的重点就是：**C++如何启动线程、等待线程结束以及如何管理线程**。

## Basic thread management

每一个$C++$的程序都至少有一个线程，其由$C++$运行时启动，用于运行`main()`。你的程序可以启动额外的线程，并且其入口点可以自行决定。那么现在，我们来看看如何启动一个新线程。

### Launching a thread

就如上一篇笔记所看到的那样，线程在`std::thread`对象构造时开始，并且指定了需要运行的任务。在简单的例子中，任务通常是简单的、无参数也无返回值的，它会在新开的线程中自行运行，结束后线程便终止。但在一些极端情况下，这个任务可以是一个`函数对象`，需要传入指定的额外参数并执行一系列独立的操作，这些操作是在运行时通过某些系统信息传递指定的，并且线程只有在收到信号时才会停止。

不过，总而言之，**对于$C++$标准库启动线程而言，总是从**`std::thread`**开始的**。

``` cc
void do_some_work();
std::thread my_thread( do_some_work );
```

当然，这只是一个极其简单的例子。对于`std::thread`而言，**它能够接收任何**`可调用对象类型`，因此讲带有`operator()`实现的类的实例传递给`std::thread`是可行的。

``` cc
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

在这种情况下，这个提供的函数对象被**拷贝**到新创建的线程所属的内存中调用。因此，**拷贝的行为必须与原始行为相同，否则结果可能不是预期的**。

有个点值得注意：当你传入一个函数对象，而这个函数对象是一个临时值时，那么$C++$会将其解释为临时变量，而非对象定义。如下所示

``` cc
std::thread my_thread( background_task() ); // [Warning] Parentheses were disambiguated as a function declaration
```

这会导致这样的提示：声明了一个单参数，返回一个`std::thread`对象的函数，而非启动了一个新线程。因此，我们有两种方式解决这个问题：

``` cc
std::thread my_thread( (background_task()) );
std::thread my_thread{ background_task() };
```

在第一种方式中，我们通过额外的括号防止将`my_thread`解释为函数声明，从而允许将`my_thread`解释为函数声明，从而允许将`my_thread`声明为`std::thread`类型的变量。那么第二种方式则是使用了$C++11$标准中的，一致性初始化语法(个人倾向于这一种方式)。

那么还有一种方式能够在使用函数对象时避免上面这一种问题：那就是使用`lambda expression`。这是在$C++11$中新增的特性，能够允许你写出局部函数，并且能够捕获局部变量，这可以避免一些额外参数的传递。

``` cc
std::thread my_thread ( [] {
    do_something();
    do_something_else();
} );
```

**一旦你启动了你的线程，就必须显式的去决定是要等待这个线程结束(join)，还是让这个线程自行运行(detach)，如果你在该线程结束前都没有确定它运行的方式，那么你的程序会被强制终止**(`std::tread`会调用`std::terminate()`)。

如果你并不希望等待(join)线程完成，则**需要确保线程访问的数据在线程完成之前是有效的**。这和单线程程序是一样的，如果你在一个对象销毁后继续访问，那么其结果是未定义的。

你可能会遇到这样的问题：当你的线程函数包含了一个局部变量的指针或引用，并且当函数退出时，该线程仍未结束。下面给出一个例子

``` cc
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

可以看见，这一个例子中，`my_thread`调用了`detach()`，因此该新线程可以自由运行，但该线程的激活函数使用了局部变量`some_local_state`的引用，当`my_thread`运行出该作用域时，`some_local_state`被销毁，因此线程中的`do_something(_i)`就可能访问到未定义的数据。下面给出一个简单的表以便观察：

|            Main Thread             |                                  New Thread                                   |
|:----------------------------------:|:-----------------------------------------------------------------------------:|
| 用`some_local_state`的引用来构造`my_func` |                                                                               |
|           创建`my_thread`            |                                                                               |
|                                    |                                     开始运行                                      | 
|                                    |                             调用`func::operator()`                              |
|           分离`my_thread`            |                    运行`func::operator()`；调用`do_something()`                    | 
|        销毁`some_local_state`        |                                     仍旧运行                                      |
|             退出`oops`函数             | 仍旧运行`func::opeartor()`；调用`do_something(some_local_state)` $\Rightarrow$ 未定义行为 |

处理这种情况的最常见方法就是使线程函数自包含并且拷贝数据到线程中，而非使用共享数据。**在函数中创建一个可以访问该函数中的局部变量的线程是一个不好的设计，除非线程能够保证在函数退出前完成**。或者，你可以使用`join()`来确保线程函数在函数退出前完成。

### Waiting for a thread to complete

如果你想等待一个线程的完成，那你就应该在对应的线程实例上调用`join()`函数。就如同上面那个例子，如果你将`detach()`替换为`join()`，那么该线程就能够在函数退出前完成，因此`some_local_state`局部变量就不会被销毁，因此是有意义的。显然的，在单独线程上运行函数没有什么意义，但在实际代码中，原始线程要么有工作处理，要么在等待所有线程完成之前启动几个线程来做有用的工作。

`join()`是一个简单粗暴的方案————你要么等待线程完成，要么不等待。如果你想进行一些更深入、详细的控制，比如检查线程是否完成、只等待一段时间等等，你可以使用我们将在第四篇笔记中讲到的`条件变量(condition variable)`和`futures`机制。调用`join()`的行为也会**清空该线程实例的任何内存空间**，因此这个线程不再与`std::thread`的**任何实例**相关联。这就意味着，**对于每一个给定的线程实例，只能够调用一次**`join()`，一旦你调用了`join()`，那么该线程实例就不再是可连接的(joinable)，因此`joinable()`就应该返回$false$。

### Waiting in exceptional circumstances

在之前我们提到，你需要确保在`std::thread`实例被销毁前调用`join()`或`detach()`。如果你想要分离线程，那么只需要在启动线程后直接调用`detach()`即可，这并不会造成问题。但是，如果你想要等待线程，你就需要谨慎的选择调用`join()`的位置。这就意味着：**如果一个异常发生在线程启动之后**，`join()`**调用之前，那么**`join()`**的调用就可能被跳过从而导致程序异常终止**。

通常情况下，如果你想避免上述情况的发生，但是你的预期又想在非异常的地方调用`join()`，那么就应该在异常处理处也调用`join()`，如以下方式实现：

``` cc
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

上述代码使用了`try/catch`块来保证访问本地状态的线程在函数退出前结束，无论是正常退出还是异常。不过，`try/catch`**块的使用是冗长的，并且容易造成作用域错误，因此这并不是我们常用的处理方式**。

如果确保线程在函数退出之前完成这一目标是很重要的，并且无论它是因为局部变量的引用，还是其他任何原因，**确保所有可能的退出路径对这一目标的实现是异常重要的**。因此，需要一个简单、简洁的机制来实现这一功能。

一种实现方式是使用标准的`资源获取即初始化(Resource Acquisition Is Initialization，RAII)`，提供一个在其析构函数中执行`join()`的类，如下所示：

``` cc
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

当当前线程的执行到达`f()`的末尾时，**局部变量会按照与构造顺序相反的顺序进行销毁**。因此，`thread_guard`的实例是最先销毁的，所以`g`会调用其析构函数，并在内部进行`join()`调用，即便是因为异常退出，也因为跳出函数作用域而进行析构函数的调用。

`thread_guard`的析构函数会首先判断该线程实例是否能够等待(`joinable()`)，又因为`join()`自身只能够被调用一次，因此就能够判断防止重复`join()`的情况。而拷贝构造和拷贝赋值则是显式的调用了`delete`，防止编译器自动提供拷贝方式。**如果允许拷贝的存在，那么就可能跳出该线程所应该允许的范围**。

如果不需要等待线程完成，可以通过分离线程来避免这种异常安全问题。这将打破线程与`std::thread`对象的关联，并确保`std::terminate()`在`std::thread`对象被销毁时不会被调用，即使线程仍在后台运行。

### Running threads in the background

在一个线程对象上调用`detach()`会使得该线程在后台运行，在此之后没有直接的与之通信的方式；并且也不再等待该线程的完成，**其所有权和控制权转交给$C++$运行时，以确保线程退出时能够正确回收与之相关的资源。**

与$Unix$的`守护进程(daemen process)`对应的，分离的线程通常被称之为`守护线程(daemen thread)`，在后台运行并且没有任何显式的用户界面接口。这些线程都是长时间运行的，它们几乎运行在应用程序的整个生命周期，执行一些后台任务，例如：监视文件系统、清除无用的缓存条目或者优化数据结构等等。

在另一种极端情况下，使用分离线程是有意义的，因为有另一种机制来识别线程何时完成或线程用于`一次性任务(fire-and-forget task)`的位置。

> Fire-And-Forget task  
> 这个术语通常用于描述一种任务执行的方式，尤其是在计算机科学和工程领域中。"Fire-and-forget" 意味着执行者启动任务后，不再需要关注任务的结果或状态，而可以继续执行其他任务。 
> 在计算机编程中，"fire-and-forget" 可以用来描述一种异步操作的方式。当一个程序执行一个 "fire-and-forget" 任务时，它会触发一个操作，但不会等待该操作完成或返回结果。相反，程序会继续执行后续的代码，而不会被任务的执行阻塞。 
> 这种方式常用于处理那些不需要立即获得结果或不需要对结果进行进一步处理的任务。例如，在发送电子邮件时，可以使用 "fire-and-forget" 模式，将电子邮件添加到发送队列中，然后立即返回用户界面，而不需要等待所有电子邮件都成功发送。

就如你在之前见到的示例，分离线程后，该线程实例就不再会被等待。

``` cc
std::thread t( do_background_task );
t.detach();
assert( !t.joinable() );
```

还需要注意的是，**你可以使用**`joinable()`**来检查该实例对象是否可以被**`join()`**或者**`detach()`。

现在来考虑一个应用程序，比如一个可以同时编辑多个文档的文本编辑器。这里有很多种方式来实现，不论是从$UI$层面还是从内部。目前越来越普遍的一种方式是使用多个独立的顶级窗口，每个正在编辑的文档对应一个窗口。尽管这些窗口看上去完全独立，并且有用自己的菜单栏，但实际上它们是运行在应用程序的相同实例中。另一种处理方式就是每一个文档编辑窗口就是一个线程，每一个线程都运行同样的代码，只是正在编辑的文档和对应的窗口属性相关的数据不同。 打开一个新的文档就是创建了一个新进线程，处理请求的线程不会关心等待另一个线程完成，因为它正在处理一个不相关的文档，所以这使得它成为运行一个分离线程的主要候选者。

这里是一个简单的实现大纲:

``` cc
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

我们在上面的例子中看到，向`std::thread`构造函数传递附加参数在本质上与向可调用对象或函数传递参数一样简单。但是最重要的一点是：**默认情况下，参数会被拷贝进内部的内存空间(以右值的方式)，其能够被新线程的执行流所获取并使用和访问，并以**`右值(rvalue)`**的形式传递给可调用对象或函数作为参数**。

``` cc
void f( int i, const std::string& s );
std::thread( f, 3, "hello" ); 
```

指的注意的是，**尽管**`f`**第二个参数接收的形式为**`const std::string&`，**但字符串字面量会被当作**`const char*`**传递，仅在新线程的上下文中被转换为**`std::string`。

``` cc
void f( int i, const std::string& s );

void oops( int some_param ) {
	char buffer[1024];
	sprintf(buffer, "%i", some_param);
	std::thread t( f, 3, buffer );  // [Warning]: it might be dangling pointer
	t.detach();
}
```

在这个例子中，`buffer`是指向局部变量的一个指针，其被传递给新线程。**在新线程上将其转换为**`std::string`**之前**，`oops`**函数可能退出，从而导致未定义行为**。因此，应该在传入`buffer`前，将其转换为`std::string`就能够解决。

``` cc
void f( int i, const std::string& s );

void not_oops( int some_param ) {
	char buffer[1024];
	sprintf(buffer, "%i", some_param);
	std::thread t( f, 3, std::string( buffer ) );   // Using std::string avoids dangling pointer
	                                                // [Warning]: convert too late
	t.detach();
}
```

在这个例子中，我们想要通过显式地提前转换`buffer`为对应的类型，**但是这个转换可能发生的太晚，从而导致没有产生出预期类型和结果**。

而这种情况：参数是被拷贝的，而你想要一个`non-const`的引用，这是不可能的，会导致编译错误。如下面所示：

``` cc
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

尽管`update_data_for_widget`函数的第二个参数要求是`widget_data`的引用类型，但是`std::thread`的构造函数并不认识这个类型；**因为它忽略了其所期待的参数类型，只是盲目的将参数给拷贝过去。并且，其内部实现也只是将其以右值的形式传递过去，因为整个**`std::thread`**的构造函数都被设置为是右值的**。这就导致了编译错误，因为你**无法传递一个右值给一个**`non-const`**类型**。如果你熟悉`std::bind`的话，那么很轻易就能够想到，我们需要将这个参数使用`std::ref`进行封装成为引用。

``` cc
std::thread t ( update_data_for_widget, w, std::ref( data ) );
```

修改之后，就能够成功通过编译，并且传递一个引用的参数进入函数内部。

如果你熟悉`std::bind`，那么对于`std::thread`的参数传递语义就不那么难以理解，因为`std::thread`**的构造器和**`std::bind`**的实现机制是相同的**。这就意味着，你可以传递成员函数指针作为函数，并提供一个合适的对象指针作为第一个参数：

``` cc
class X {
public:
    void do_lengthy_work();
};

X my_x;
std::thread t ( &X::do_lengthy_work, &my_x );
```

上面的代码会在新线程中调用`my_x.do_lengthy_work()`，因为`my_x`的地址作为对象指针被提供给了线程的构造函数。还可以为成员函数提供参数，构造函数的第三个参数就会作为第一个参数，以此类推。

另一个提供参数的有趣场景是：**参数不能被拷贝，只能被**`move(移动)`。这种类型的一个例子就是`std::unique`，其为动态分配的对象提供自动内存管理。每次只有一个`std::unique`实例指向所给定的对象，当该实例被销毁时，其指向的对象也会被删除。`move constructor`和`move assignment operator`允许在`std::unique`实例之间转交对象的所有权。如果是临时对象，那么移动则会自动发生；如果是有名对象，那么就需要通过`std::move`来显式地指定移动语义。

``` cc
void process_big_object( std::unique_ptr< big_object > );
std::unique_ptr< big_object > p ( new big_object );
p->prepare_data( 42 );
std::thread t ( process_big_object, std::move(p) );
```

**这种所有权可以在实例之间进行转移**，因为`std::thread`的**实例是可移动的，尽管它们不可复制。这确保在任何时候只有一个对象与特定的执行线程相关联，同时允许我们选择在对象之间转移该所有权**。

## Transferring ownership of a thread

假设你想编写一个函数，创建一个后台线程来运行，但是将新线程的所有权交回给调用函数，而不是等待它完成；或者你可能想要相反的情况：创建一个线程，并将所有权传递给某个函数，该函数应该等待它完成。在任何情况下，你都需要将所有权从一个地方转移到另一个地方。

这就是`std::thread`支持移动语义的所在之处。这就意味着一个执行线程的所有权是能够在`std::thread`实例之间移动的，下面的例子展示了创建两个执行线程，并在三个`std::thread`实例`t1`、`t2`和`t3`之间转移这些线程的所有权：

``` cc
void some_function();
void some_other_function();
std::thread t1( some_function );
std::thread t2 = std::move( t1 );
t1 = std::thread( some_other_function );
std::thread t3;
t3 = std::move( t2 );
t1 = std::move( t3 );   // [Warning]: This assignment will terminate the program!
```

在`t1 = std::move( t3 )`执行之前，我们可以看见线程实例的所有权在它们之中相互传递，这都是能够正常进行的。但是，当`t1 = std::move( t3 )`执行时，我们可以发现，此时`t1`本就关联了一个线程实例，当我们移动`t3`的所有权给`t1`时，`t1`原本的资源便会在没有`join()`或`detach()`的情况下被遗失，因此，就会调用`std::terminate()`。这样做是为了保证`std::thread`析构的一致性：**不能通过给管理线程的**`std::thread`**对象赋一个新值来删除线程**。

`std::thread`支持移动语义就意味着**所有权可以很容易地从函数中转移出来**，下面就是一个例子：

``` cc
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

同样的，如果所有权需要被转交给一个函数，它可以按值接收一个`std::thread`的参数，如下所示：

``` cc
void f( std::thread t );
void g() {
	void some_function();
	f( std::thread( some_function ) );
	std::thread t( some_function );
	f( std::move( t ) );
}
```

`std::thread`支持移动语义的一个好处就在于：：**能够让一些需要的地方获取它的所有权**。就比如在先前我们所创建的`thread_guard`类，我们就能够在此基础上进行修改。

``` cc
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

这个示例和`thread_guard`类似，但是新线程直接被传递给`scoped_thread`，不必创建一个单独的命名变量。同时，当`scoped_thread`被销毁时，不需要判断线程是否可连接，直接调用`join()`即可。

在`C++17`中有一个关于`joining_thread`的草案，其与`std::thread`类似，但会像`scoped_thread`那样自动在析构函数中调用`join()`。但该草案并没有在标准委员会中得到认可，反而是在`C++20`中以`std::jthread`的形式出现。下面给出了一个可能实现：

``` cc
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

`std::thread`移动语义的支持还允许使用std::thread对象的容器，比如说更新后的`std::vector`。

``` cc
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

如果线程被用来划分算法的工作，通常需要满足以下条件：**在返回给调用者之前，所有线程必须都已完成**。上面的代码的简单结构意味着线程所执行的工作是自包含的，它们的操作结果仅仅是对共享数据的副作用。如果f`()`**函数需要向调用者返回一个依赖于这些线程操作结果的值，那么按照目前的写法，这个返回值必须通过在线程终止后检查共享数据来确定**。在后面的第四篇笔记中，我们将讨论在线程之间传递操作结果的其他方案。

将`std::thread`对象放在`std::vector`中是朝着自动化管理这些线程迈出的一步:**不必为这些线程创建单独的变量并直接与它们连接，而是可以将它们视为一个组**。你可以更进一步，在运行时创建动态线程数，而不是创建固定数量。

## Choosing the number of threads at runtime

$C++$标准库中一个有用的功能就是：[std::thread::hardware_concurrency()](https://en.cppreference.com/w/cpp/thread/thread/hardware_concurrency)。这个函数返回一个指示，**表明在给定的程序执行过程中可以真正并发运行的线程数**。在一个多核系统中，这个数量可能是$CPU$的核心数。

下面是一个代码示例，展示了一个简单的[std::accumulate()](https://en.cppreference.com/w/cpp/algorithm/accumulate)的并行化版本的实现。在实际中，你可能还会想要使用并行化的`std::reduce`算法而非自行实现，这将会在第十篇笔记中讲解。在下面的示例中，它将会划分每个线程的任务数量，使得每个线程都执行一个较少数量的任务，以避免额外过多开销。

``` cc
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

尽管这个代码看上去比较长，但实际上简单易懂。假定你的机器有$32$个核心。

- 第一步，确定任务所需的最大线程数
  - **如果输入的范围为空，就应该返回作为**`init`**参数的初始值作为返回值**。
  - 否则，只要有一个元素在`range`中，你就能将要处理的元素数量除以`block_size`，就得到所需要的最大的线程数量`max_threads`(这一步是为了避免创建过多的线程资源)。
- 第二步，计算真正运行的线程数
  - 我们不希望运行超过硬件所能支持的线程数(这被称为`oversubscription(超额订阅)`)，因为上下文切换将意味着更多的线程将降低性能。
  - 如果`std::thread::hardware_concurrency()`返回了$0$，那么就用自己设置的值作为代替，这里的代替值是$2$
  - 否则，就用实际的硬件线程数量与我们所得到的最大线程数量取最小值，这样就得出真正运行的线程数量`num_threads`(**因为如果线程过多，就会导致单核上的性能下降；如果线程过少，又不能实现并行化**)
- 第三步，计算每一个线程应该执行的任务数
  - 每个线程要处理的条目数是该任务范围的长度`block_size`除以真实运行的线程数。
- 第四步，创建线程空间和结果保存的空间
  - 现在你已经计算出真正线程运行的数量以及每个线程将要执行的任务数量，所以就应该给出对应的资源
  - `std::vector< T > results`作为每个线程运行结果存储的位置
  - `std::vector< std::thread > threads`作为每个线程运行的空间和管理的容器(**你需要创建比我们计算出的真实运行的线程数少于一个的空间，因为运行时线程也能够参与计算**)
- 第五步，划分每一个线程需要计算的任务块
  - 通过一个简单的循环来划分每一个线程所执行的范围$[first, last)$
  - `std::advance( block_end, block_size )`和`block_start = block_end;`是确定任务区间的主要逻辑；`accumulate_block< Iterator, T > ()`则是线程运行的实际逻辑
- 第六步，累加所有结果
  - 在`results`中存放了每一个线程所计算的对应任务区间的长度，通过`std::accumulate(results.begin(), results.end(), init)`就能够得到其最终结果

这里还有一些点需要注意：**迭代器至少是**`forward iterator(向前迭代器)`, `T`**类型必须是可默认构造的，以便能够创建**`results`。同时，**我们并不能在线程中直接的返回一个值**，这在后续的第四篇笔记中通过`future`解决；在第八篇笔记中，我会深入的解析并行算法；而在第十篇笔记，则会介绍一些$C++17$标准库中的并行算法。

在这个例子中，我们所有的数据都是在线程初始化时传递的(包括计算结果所要存放的位置)。事实上，我们总会有一些数据是需要通过在运行中才能得出的，比如说我们需要定位某一个线程并获取其位于哪一层调用栈。因此在$C++$标准库的设计中，每一个线程都有一个独一无二的标识。

## Identifying threads

线程标识符的类型为[std::thread::id](https://en.cppreference.com/w/cpp/thread/thread/id)，其有两种方式能够获取。第一种，线程标识符可以通过调用[get_id()](https://en.cppreference.com/w/cpp/thread/thread/get_id)从与之关联的线程对象中获取；另一种方式是通过[std::this_thread::get_id()](https://en.cppreference.com/w/cpp/thread/get_id)获取到**当前线程**的线程标识符。

`std::thread::id`类型的实例**可以随意地拷贝和比较**，否则它就毫无意义。如果两个实例相等，那么就标识它们是同一个线程或都为`not any thread`值。

$C++$标准库**不仅不限制您只能检查线程标识符是否相同，而且**`std::thread::id`**类型的对象提供了完整的比较运算符集合，为所有不同的值提供了完全的排序。这使得它们可以用作关联容器中的键，或进行排序，或以任何你认为合适的其他方式进行比较。比较运算符为所有非相等的**`std::thread::id`**值提供了一个完全的顺序**，因此它们的行为符合您的直觉期望：**如果$a \lt b$且$b \lt c$，那么$a \lt c$，依此类推**。标准库还提供了[std::hash< std::thread::id >](https://en.cppreference.com/w/cpp/thread/thread/id/hash)，**以便**`std::thread::id`**类型的值也可以用作新的无序关联容器中的键**。

`std::thread::id`**的实例通常用于检查线程是否需要执行某些操作**，就如下面的实例所展示的一样：

``` cc
std::thread::id master_thread;
void some_core_part_of_algorithm() {
	if ( std::this_thread::get_id() == master_thread ) {
		do_master_thread_work();
	}
	do_common_thread_work();
}
```

另外，当前线程的`std::thread::id`可以作为操作的一部分存储在数据结构中。然后，对同一数据结构的后续操作可以检查存储的线程$id$与执行操作的线程$id$之间的关系，以确定允许(或需要)执行的操作。

类似地，**线程$id$可以用作关联容器中的键，用于将特定数据与线程关联起来，但不适合使用其他机制，例如线程局部存储。这样的容器可以由控制线程使用，用于存储控制下的每个线程的信息，或者用于在线程之间传递信息**。
