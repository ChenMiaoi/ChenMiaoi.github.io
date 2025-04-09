---
title: 'STL17: New Features'
mathjax: true
date: 2025-02-15 15:46:38
tags: [cpp, books, stl]
categories: [cpp]
---

# C++ STL17 CookBook: New Features

在讨论C++语言的背景之前，我们首先需要认识到一个现实：由于国内就业压力和IT行业的相对保守性，大多数C++学习者并未深入研究STL(标准模板库)以及更新的C++标准。即便是C++23标准已经发布，许多C++开发人员和学习者仍然停留在较为传统的编程风格，常常只掌握`C with Class`或`C with Simple STL`，这导致了C++语言的潜力未能得到充分发挥。

```C++
// C with Class             // C with Simple STL
class Person {              class Person {
public:                     public:
    char name[32];              std::string name;
    int age;                    int age;
    char gender[5];             std::string gender;
    ...                         ...
};                          };

class Person person;        class Person person;
person.name = "Miao";       person.name = "Miao";
person.age = 18;            person.age = 18;
person.gender = "male";     person.gender = "male";
...                         ...
```

这种现象的存在在一定程度上阻碍了C++的学习和应用，限制了开发者对语言本身的深入理解和有效使用。C++作为一种多范式编程语言，本应在面向对象、泛型编程、模板元编程等领域展现出更强大的优势。然而，过于依赖传统编程模式的做法，不仅无法体现C++语言的真正风采，甚至有可能使开发者在处理复杂任务时错失现代C++所提供的诸多便利和性能优化。

尽管C++语言本身近年来出现了诸如特性膨胀等问题，这些问题并不在本系列讨论的范围内，但需要明确的是，C++语言的演进过程仍在持续，理解和掌握语言的最新特性对提升开发者的能力是至关重要的。

本系列的目标是帮助那些已经具备C++基础，但尚未深入理解和运用STL(标准模板库)以及C++各种现代特性的开发者，掌握如何使用C++编写更加现代、有效且高效的代码。如果你还没有学习过C++，那么本系列可能并不适合你，因为我们将假定读者已经对C++的基本语法和常见概念有所了解，并且目标是让你能够充分利用语言的最新功能来编写高质量的代码。

值得注意的是，许多开发者对C++11有一定的了解，毕竟《C++ Primer》和《Effective C++》等经典书籍都是基于C++11编写的。然而，自C++11之后，尤其是C++14、C++17及更晚的标准发布后，关于这些版本的深入学习和实践的机会相对较少。因此，本系列将从C++17开始进行讲解。对于C++17之前的内容，只有在必要的情况下才会进行详细阐述。如果读者对C++11之前的特性有疑问，建议自行查阅相关文档，以便更好地跟进本系列的内容。

--- 

## Structured Binding

在现代编程语言中，解构(unpacking)已成为常见的功能之一，例如在Rust中，可以很方便地解构元组(tuple)或结构体(struct)：

``` Rust
let tup = (1, "hello", 3.14);

let (a, b, c) = tup;
println!("a: {}, b: {}, c: {}", a, b, c);
```

在C++11中，除了`std::tuple`，还引入了一个非常有用(?)的函数——`std::tie`。`std::tie`可以将一个元组的元素与变量绑定，从而提供类似解构的功能，虽然它在语法上和结构化绑定(`Structured Binding`)有所不同。`std::tie`的**作用是将元组或结构体的元素与现有变量进行关联**，而不像结构化绑定那样直接创建新变量。

```C++
std::tuple<int, std::string, double> tup = {1, "hello", 3.14};

int a;
std::string b;
double c;
// 使用 std::tie 来解构元组
std::tie(a, b, c) = tup;
std::cout << "a: " << a << ", b: " << b << ", c: " << c << std::endl;
```

可以看出，std::tie要求我们在解构之前提前规划好每个元素的类型和相应的局部变量，这无疑对编码效率和灵活性造成了一定的限制。具体来说，使用std::tie时，必须显式地指定每个变量的类型，并且这些变量必须在解构之前已经声明好。

并且，`std::tie`并不支持直接的引用解构，需要使用`std::ref`，这也使得学习和编码难度上升。

```C++
std::tuple<int, std::string, double> tup = {1, "hello", 3.14};

int a;
std::string b;
double c;

// 使用 std::ref 传递引用
std::tie(std::ref(a), std::ref(b), std::ref(c)) = tup;

// 修改解构后的值
a = 10;
b = "world";
c = 6.28;

std::cout << "a: " << a << ", b: " << b << ", c: " << c << std::endl;
```

因此，为了更好的支持更方便的解构，C++17引入了结构化绑定(Structured Binding)。通过这种语法糖，C++能够以类似的方式解构std::pair、std::tuple、结构体和数组：

```C++
auto [var1, var2, ...] = <pair, tuple, struct, or array expression>;
```

- `std::pair`和`std::tuple`。
- `struct`：结构体的成员必须是非静态的(non-static)，且定义在同一个类中。
- `array`：必须是固定大小的数组(即大小在编译时已知)。

通常，我们会结合`auto`来自动推导类型，**如果条件允许的情况下，尽可能的使用引用以减少拷贝**。

```C++
std::tuple<int, std::string, double> tup = {1, "hello", 3.14};
auto [a, b, c] = tup;  // 解构元组
std::cout << "a: " << a << ", b: " << b << ", c: " << c << std::endl;
```

> QUESTION: 许多人可能会认为大量使用解构(比如通过结构化绑定来解构元组、std::pair 或者其他数据结构)会导致性能问题，尤其是在涉及到返回值的情况下。传统上，C++开发者习惯于通过引用参数来传递结果(即使用“out parameter”模式)，认为这样能够避免拷贝操作，提高效率。然而，现代C++编译器通常会对返回值进行返回值优化(RVO，Return Value Optimization)或命名返回值优化(NRVO，Named Return Value Optimization)，从而大大减少了不必要的拷贝开销。  
> 关于RVO和NRVO会在额外的单独章节中进行讲解。

当然，`structured binding`并非全都是好处，相比`std::tie`，`structured binding`没有提供一个直接的机制来忽略元组或结构体中的某些元素，类似于Rust中的`_`或者说`std::ignore`。

因此，你必须显示地声明每一个位置的变量进行接收，甚至是你根本不关心的值。

### Action

在实际的开发中，我们会在以下几个方面经常用到`structured binding`：

- `std::map`(实际上是`std::pair`)

```C++
std::map<int, std::string> m = {{1, "one"}, {2, "two"}, {3, "three"}};
for (const auto& [key, value] : m) {
    std::cout << "Key: " << key << ", Value: " << value << std::endl;
}

struct Point {
    int x, y;
};
std::vector<Point> points = {{1, 2}, {3, 4}, {5, 6}};
for (auto& [x, y] : points) {
    std::cout << "x: " << x << ", y: " << y << std::endl;
}
```

- `function return value`

```C++
std::tuple<int, double, std::string> get_values() {
    return {42, 3.14, "example"};
}

auto [x, y, z] = get_values();
std::cout << "x: " << x << ", y: " << y << ", z: " << z << std::endl;
```

- `error handling`

```C++
std::pair<bool, std::string> get_optional_value() {
    return std::make_pair(true, "example");
}

if (auto [x, y] = get_optional_value(); x) {
    std::cout << "y: " << y << std::endl;
} else {
    std::cout << "No value present!" << std::endl;
}
```

### How To Work

现在我们来简单讲解一下结构体绑定的实现。在 `C++17` 的 结构化绑定(`structured binding`) 机制中，编译器会为 `identifier-list` ($v0, v1, v2, ...$) 生成一组变量，并将其绑定到 `initializer`(初始化表达式)的元素。该机制的底层实现依赖于 `自动类型推导` 和 `对象解构`，并有以下假设：

- 设`cv`代表`cv-qualifiers`：即`cv`限定符(`const`和~~volatile~~)。*在C++20中，`volatile`的用法已被移除*
- 设`S`代表`decl-specifier-seq`中的`storage-class specifiers`(例如：`static`)
- 设`A`代表元素类型

1. 当 `initializer` 的 赋值表达式(`assignment-expression`) 具有 `cv A` 类型的数组，且没有引用限定符(`ref-qualifier`)时，结构化绑定的行为如下：
$$
attribute-specifier-seqopt \ S \ cv \ A \ e ;
$$

```C++
// Seem To:
const int arr[3] = {1, 2, 3};  // 这个数组类似 initializer
auto [x, y, z] = arr;

const int e[3] = arr;          // e 的声明方式类似于这里 attribute-specifier-seqopt S cv A e ;
auto& x = e[0];  // x 绑定到 e 的第 0 个元素
auto& y = e[1];  // y 绑定到 e 的第 1 个元素
auto& z = e[2];  // z 绑定到 e 的第 2 个元素
```

其中，`e`**的每个元素都会从`assignment-expression`的对应元素中拷贝初始化或直接初始化，具体方式由`initializer`的形式所决定**。

2. 如果 `initializer` 的 赋值表达式(`assignment-expression`)不是数组类型，则结构化绑定的行为如下：

$$
attribute-specifier-seqopt \ decl-specifier-seq \ ref-qualifieropt \ e = initializer ;
$$

- `attribute-specifier-seqopt`(可选的属性说明符序列)：允许使用属性(如`[[nodiscard]]`)
- `decl-specifier-seq`：通常为 `auto`
- `ref-qualifier`：可能是`&`或`&&`，表示是否使用引用

```C++
// Seem To:
std::tuple<int, double, char> t = {1, 2.5, 'a'};
auto [x, y, z] = t;

auto e = t;   // 这里的 e 相当于 attribute-specifier-seqopt decl-specifier-seq ref-qualifieropt e = initializer;
auto& x = std::get<0>(e);
auto& y = std::get<1>(e);
auto& z = std::get<2>(e);

// 实际上可能的内部展开
decltype(auto) __binding_obj = tuple;
decltype(auto) a = std::get<0>(__binding_obj);
decltype(auto) b = std::get<1>(__binding_obj);
decltype(auto) c = std::get<2>(__binding_obj);
```

## Scoped Variable With If and Switch

在 C++ 代码设计中，变量的作用域管理是影响代码可读性和可维护性的关键因素之一。良好的作用域管理不仅有助于避免命名冲突，还能减少无关变量对代码逻辑的干扰。在 C++17 之前，开发者经常面临一种常见情况：

在 C++ 代码中，经常需要对某个表达式的计算结果进行条件判断。例如，考虑以下代码：

```C++
auto s = is_ok(something);
if (!s) {
    // error handling
}
...
```

在此代码中，`s` 仅用于 if 语句的判断条件，而在 `if` 语句之外并无实际用途。然而，由于 C++17 之前 if 语句不支持在条件部分定义变量，因此 s 不得不提前声明，从而污染了外部作用域。

这种不必要的变量泄露可能导致：

- 命名冲突 (Name Clashes)：在相同作用域下反复使用相同名称的变量，可能增加代码的复杂性和可读性负担。
- 作用域污染 (Scope Pollution)：某些变量仅在特定语句块内使用，但由于语言特性，不得不提升其作用域。
- 代码可读性下降 (Reduced Readability)：读者需要关注不必要的变量定义，降低代码逻辑的直观性。

为了提高代码的可维护性，现代 C++ 遵循 最小作用域原则 (Minimizing Scope of Variables)，即“变量的作用域应尽可能小，仅限于其被使用的最小范围”。

这一原则的核心思想包括：

- 局部化 (Localization)：变量的生命周期应尽可能短，避免被误用或无意中修改。
- 封装性 (Encapsulation)：将变量限定在尽可能小的作用域，以减少潜在的命名冲突。
- 即时初始化 (Immediate Initialization)：在变量定义时立即初始化，减少未初始化变量的风险。

在 C++17 之前，由于 if 语句不支持直接在条件部分定义变量，开发者不得不在 if 语句之前定义额外的变量，导致作用域扩展。因此，C++17 引入了一种新特性来优化这一模式。

C++17 引入了 if 语句的 初始化子句 (Init-Statement)，允许开发者在 if 语句的条件部分直接声明和初始化变量，从而优化作用域管理。例如：

```C++
if (auto s = is_ok(something); !s) {
    // error handling
}
...
```

### Action

在 C++ 代码中，资源的生命周期通常与变量的作用域绑定，这是 资源获取即初始化 (RAII, Resource Acquisition Is Initialization) 的核心思想。RAII 机制确保资源在对象构造时获取，并在对象析构时释放。例如，在多线程编程中，std::lock_guard<std::mutex> 通过 RAII 自动管理互斥锁 (std::mutex) 的加锁与解锁。

```C++
// using if init-statement                                              // using traditional if 
if (std::lock_guard<std::mutex> lg {my_mutex}; some_condition) {        {
    // do something                                                         std::lock_guard<std::mutex> lg {my_mutex};
}                                                                           if (some_condition) {
                                                                                // do something
                                                                            }
                                                                        }
```

这种模式适用于任何 RAII 类型的资源管理，例如：

- `std::unique_lock<std::mutex>`(支持更灵活的锁管理)
- `std::ifstream`(文件流自动关闭)
- `std::scoped_lock`(C++17 引入的通用多互斥锁管理)

### How To Work

实际上，`if init-statement` 本质上是一种基础的语法糖，它可以被等价转换为如下形式：

$$
\begin{aligned}
    &\texttt{if constexpr}_{opt} \ (\texttt{init-statement}_{opt} \ \texttt{condition}) \ \texttt{statement} = \\
    \{\\
        &\texttt{init-statement}_{opt} \\
        &\texttt{if constexpr}_{opt} \ (\texttt{condition}) \ \texttt{statement} \\
    \}
\end{aligned}
$$


这意味着 if init-statement 语句的行为等同于在 if 语句之前引入一个新的作用域 {}，并在其中执行 init-statement，然后再执行 if 条件判断。这种转换不会改变底层语义，只是提供了一种更加紧凑的写法，使代码更易读、更符合局部作用域管理的最佳实践。

## Automatically deduce the resulting class type

## Constexpr

在现代编程中，C++关注到编译时常量的引入可显著减少运行时的计算负担，特别是在高频调用的场景中，避免了重复的运行时计算。因此，在C++11中，C++首次提出了`constexpr`关键字允许开发者显式声明一个变量或函数的值在编译时求解，确保其为常量表达式，进而实现更早的优化和更严格的编译期检查。

## Inline

在C/C++编程语言中，`inline`关键字是一个广为人知的特性，大多数开发者对其基本功能有一定的了解。然而，对于C语言中的inline与C++中的inline之间的区别，以及随着C++标准的演进，inline语义的变化，却鲜有人深入探讨。

### C Inline

首先，我们将详细探讨C语言中的inline关键字的定义及其作用(鉴于本系列教程主要关注C++，因此我们将仅讨论到C11标准)。

第一步我们先来了解下C语言中inline的作用：

- 提高执行效率：通过消除函数调用开销，减少函数调用的栈操作，适合小函数。
- 优化编译器的优化机会：可以让编译器更好地进行进一步的优化，如常量折叠、死代码消除等。
- 改善代码可读性和可维护性：比宏更加清晰、类型安全且易于调试。

在C11标准(ISO/IEC 9800:201x文档)中对`inline`关键字有明确的约束：

- `inline`应该只能被用于一个函数标识符的声明中。

``` C++
inline int x; // Error, inline specifier allowed on function declarations only
```

具有外部链接(external linkage)的内联函数定义不应该包含含有静态存储期(static storage duration)或线程存储期(thread storage duration)的可修改对象的定义，也不应该引用具有内部链接(internal linkage)的标识符。

1. 静态存储期的对象(如 static 变量)或线程存储期的对象(如 thread_local 变量)在程序运行期间具有持久性。内联函数可能会被多次展开到不同的调用点，如果允许定义这类对象，可能会导致多个副本或冲突，从而引发未定义行为。

``` C++
inline void counter() {
    static int x = 0;
    x++;
}

note: use 'static' to give inline function 'counter' internal linkage
warning: non-constant static local variable in inline function may be different in different files
```

2. 内部链接(internal linkage)的标识符(如 static 函数或 static 全局变量)仅在当前翻译单元(translation unit)内可见。如果内联函数引用了这类标识符，而该内联函数被其他翻译单元使用，就会导致链接错误或未定义行为。

``` C++
static int internal_var = 10;

inline void counter() {
    int y = internal_var;
}

warning: static variable 'internal_var' is used in an inline function with external linkage
```

**这些限制的目的是确保内联函数的行为在不同翻译单元之间保持一致，并避免潜在的链接或运行时问题。在实际测试中，编译器并不会将其视作inline的**。

- 在`hosted environment`中，`main`函数的声明不得出现任何函数说明符(function specifier)。

标准明确禁止在 main 函数的声明中使用任何函数说明符。这是因为 main 函数的调用和返回机制是由运行时环境(runtime environment)管理的，任何额外的修饰都可能破坏其标准行为。

> C Standard Enviroment
>
> C语言标准规定了两种主要的执行环境：
>
>> Hosted Environment  
>> 完整的C语言执行环境，通常依赖于操作系统，并提供完整的标准库支持；程序从`main`函数开始执行
>>
>> Freestanding Environment  
>> 不依赖于操作系统的简化执行环境，通常用于嵌入式系统、操作系统内核或裸机程序；程序的入口点不一定是 `main` 函数，具体由实现定义

任何具有内部链接(internal linkage)的函数都可以是内联函数。对于具有外部链接(external linkage)的函数，适用以下限制：

如果一个函数被声明为 inline，那么它必须在同一翻译单元(translation unit)中定义:

``` C++
static inline void func() {}
```

如果在某个翻译单元中，某个函数的所有文件作用域声明都包含 inline 函数说明符且没有 extern，那么该翻译单元中的定义是一个内联定义(inline definition)

首先我们需要理解什么叫做：**所有文件作用域(all of the file scope declarations for a function in a translation unit)**

``` C++
// file1.c
inline void func(); // 
inline void func() {} //
```

``` C++
// file2.c
extern void func(); //
inline void func() {} //
```

内联定义不会为该函数提供外部定义(external definition)，也不禁止在其他翻译单元中提供外部定义

``` C++
// file1.c
inline void func() {}

// file2.c
void func() {}
```

内联定义是外部定义的替代方案，编译器可以使用它来实现同一翻译单元中对函数的调用。对于函数的调用是使用内联定义还是外部定义，是由实现定义的(unspecified)。

---

#### Using C Inline

在C语言中，inline关键字用于提示编译器将函数内联展开，以减少函数调用的开销。然而，inline的行为会受到extern和static关键字的影响，尤其是在涉及函数的链接属性(linkage)时。在实际开发中，许多C语言开发者通常更倾向于使用static inline，这也是最为常见和推荐的用法。

`static inline`用于定义具有内部链接(internal linkage)的内联函数。这种函数的作用域仅限于当前翻译单元(translation unit)，其他翻译单元无法访问该函数。由于函数的作用域被限制在当前翻译单元内，因此不会与其他翻译单元中的同名函数产生冲突。

``` C++
// file1.c
static inline int add(int a, int b) {
    return a + b;
}
```

在上述代码中，add函数仅在file1.c中可见，其他翻译单元无法调用它。编译器可以选择将add函数内联展开，以减少函数调用的开销。

extern inline用于定义具有外部链接(external linkage)的内联函数。这种函数的作用域不限于当前翻译单元，其他翻译单元可以访问该函数。然而，使用extern inline时，**必须确保在其他翻译单元中提供一个非内联的外部定义，以便链接器能够正确解析函数的引用**。

``` C++
// file1.c
extern inline int add(int a, int b) {
    return a + b;
}

// file2.c
int add(int a, int b) {
    return a + b;
}
```

在上述代码中，file1.c中的add函数是一个内联定义，编译器可以选择将其内联展开。而在file2.c中，提供了一个非内联的外部定义，以确保链接器能够找到该函数。

**如果仅使用inline关键字而不加extern或static修饰，其行为类似于extern inline，但具体的链接属性由编译器决定。这种用法可能会导致不确定的行为，尤其是在跨翻译单元使用时。因此，为了明确函数的链接属性，建议在使用inline时显式指定extern inline或static inline**。

通过合理使用static inline和extern inline，可以在C语言中实现高效的内联函数，同时避免链接冲突和未定义行为。在实际开发中，static inline因其简单性和明确的作用域限制，成为最为常见和推荐的用法。

> 实际上，在开发中的99%都不会用上奇怪的`extern inline`。

---  

### C++ inline

#### C++98

C++98标准中引入了inline关键字，而国内许多C++开发者和学习者往往是从C语言过渡到C++的，因此可能会误认为C语言中的inline与C++98中的inline功能相同，使用方式也一致。然而，尽管两者在语法上相似，但其设计目标和行为存在显著差异。

在C语言中，inline关键字主要用于优化提示，鼓励编译器将函数内联展开，以减少函数调用的开销。C99标准引入inline时，更注重与C语言的编译模型和链接规则的兼容性。C语言中的inline函数通常需要在某个翻译单元中提供非内联的外部定义，以确保链接器能够正确解析函数的引用。此外，C语言禁止在具有外部链接的inline函数中定义静态存储期对象(如static变量)，以避免多个翻译单元中的重复定义问题。

C++98中的inline关键字不仅是一种优化提示，还是一种链接属性机制。其主要目标是支持头文件中的函数定义，避免在多个翻译单元中重复定义函数导致的链接错误。因此，在C++98中，在多个翻译单元中定义相同的inline函数(通常通过头文件实现)是合法的，链接器会确保只有一个实例被使用。此外，C++98不需要显式提供非内联的外部定义，编译器会自动处理inline函数的链接问题。

并且，C++98允许在inline函数中定义静态存储期对象(如static变量)，并且这些对象在多个翻译单元中是共享的：

``` C++
inline int counter() {
    static int x = 0;
    return ++x;
}
```

在上述代码中，static变量x在多个翻译单元中共享，确保了其唯一性和一致性。

**值得注意的是，由于C++中有`class`的概念，因此，在完全定义的`class/struct/union`中，无论是成员函数还是友元函数，都是一个隐式的inline函数**。

对于大多数C++开发者来说，上面涉及到的C++98前的inline则被一直延续下去(此时的inline主要是作为编译器是否优化的指标)；但在C++11后，更加强调 inline 函数能够在多个翻译单元中出现且不导致重复定义的链接错误。

#### C++11

在C++11中，inline关键字的功能发生了显著变化。它不再主要作为编译器优化函数的参考指标，而是更多地用于解决链接问题，确保inline函数能够在多个翻译单元中重复定义而不会导致链接错误。同时，C++11沿用了C++98中class、struct和union成员函数隐式内联的规则，即类内定义的成员函数默认具有inline属性。

C++11引入了constexpr关键字，用于定义编译时常量表达式函数。constexpr函数在首次定义时隐式地具有inline属性，这意味着：

- constexpr函数可以在多个翻译单元中定义(通常通过头文件实现)，而不会导致链接错误。
- 编译器会自动处理constexpr函数的链接问题，无需显式提供非内联的外部定义。

``` C++
constexpr int add(int a, int b) {
    return a + b;
}
```

C++11引入了delete关键字，用于禁用类的某些成员函数(如拷贝构造函数、拷贝赋值运算符等)。被删除的函数隐式地具有inline属性，因此：

- 被删除函数的定义可以出现在多个翻译单元中，而不会导致链接错误。
- 这种设计解决了= delete声明可能引发的重复定义问题。

``` C++
class MyClass {
public:
    MyClass() = default;
    MyClass(const MyClass&) = delete;
};
```

随着软件规模的扩大，类名和函数名重复的可能性显著增加。为了避免命名冲突，开发者通常使用namespace来组织代码。然而，嵌套过多的namespace以及版本控制的需求，使得开发者常常依赖宏或符号前缀(Symbol Prefix Overlay, SPO)来区分不同版本的实现。

``` C++
// Using Macro
#define LIB_VERSION 1

namespace Lib {
#if LIB_VERSION == 1
    void func() { std::cout << "v1" << std::endl; }
#elif LIB_VERSION == 2
    void func() { std::cout << "v2" << std::endl; }
#endif
}

// Using SOO
namespace Lib {
    void v1_func() { std::cout << "v1" << std::endl; }
    void v2_func() { std::cout << "v2" << std::endl; }
}
```

C++11引入了`inline namespace`，为版本控制提供了更安全、更灵活的解决方案。`inline namespace`中的内容会被视为外层命名空间的一部分，从而简化了版本切换和符号管理。

``` C++
namespace Lib {
    inline namespace v1 { // default version
        void func() { std::cout << "v1" << std::endl; }
    }
    namespace v2 { // 新版本
        void func() { std::cout << "v2" << std::endl; }
    }
}

int main() {
    Lib::func(); // using v1 version func by default
    Lib::v2::func(); // using v2 version func explicit
    return 0;
}
```

#### C++17

在C++17中，考虑到当前inline已经是确保重复定义而不会导致链接错误，在之前的标准中只提供了函数的inline版本，而如果我们想要在头文件中声明一个变量，则必须使用如下的方式去声明和定义，二者缺一不可：

在C++17之前，如果需要在头文件中声明一个全局变量，必须使用extern关键字在头文件中声明变量，并在某个源文件中提供定义。例如：

``` C++
// In header
extern int x;

// In source
int x = 0;
```

这种方式需要分别在头文件和源文件中进行声明和定义，二者缺一不可，否则会导致链接错误。

C++17 引入了inline变量，允许在头文件中直接定义全局变量或类静态成员变量，而不会导致链接错误。具体规则如下：

- 当inline关键字用于具有静态存储期(static storage duration)的变量(如全局变量或静态类成员变量)的声明说明符序列时，它将该变量声明为内联变量(inline variable)。
- 内联变量可以在多个翻译单元中重复定义，链接器会确保只有一个实例被使用。

``` C++
inline int GLOBAL_VAR = 42;

class MyClass {
public:
    inline static int STATIC_VAR = 42;
};
```

这就解决了：

- 全局变量的定义：通过inline关键字，可以在头文件中直接定义全局变量，而无需在源文件中提供额外定义。
- 类静态成员变量的初始化：通过inline关键字，可以在类内直接初始化静态成员变量，而无需在类外定义。
- C++头文件库的支持：这一特性解决了C++头文件库开发中的主要障碍，使得头文件库的实现更加简洁和高效。

并且，C++17 还扩展了constexpr关键字的功能，使其可以用于静态数据成员。当静态数据成员在首次声明时被声明为constexpr，它会隐式地具有inline属性。这意味着：

- 可以在类内直接初始化constexpr静态数据成员，而无需在类外定义。
- 该静态数据成员可以在多个翻译单元中共享，而不会导致链接错误。

``` C++
class MyClass {
public:
    static constexpr int STATIC_VAR = 42;
};
```

C++17中，对于inline的行为做出了更为明显的规定：

**inline 函数和变量的定义需要在访问它们的翻译单元中可见**。这一规则确保了编译器能够在需要时正确地内联展开函数或解析变量的定义。

**内联函数或变量可以有多个定义，只要每个定义出现在不同的翻译单元中，并且(对于非静态内联函数和变量)所有定义都是相同的**，这就是良构的。

在命名空间作用域中，inline 的 const 变量默认具有外部链接(external linkage),对于非 inline 的 const 变量而言，默认具有内部链接。因此，一旦定义了`const inline`，那么原先的非 inline 的 const 变量都会共享同一个 inline 定义，从而不会出现链接错误。

``` C++
// file1.cc
const int globalVar = 42; // internal linkage

// file2.cc
const int globalVar = 100; // internal linkage, differ with file1

-----------------------------------------

// myheader.h
inline const int globalVar = 42; // external linkage

// file1.cpp
#include "myheader.h"
void func1() {
    int value = globalVar; // Using external linkage variable
}

// file2.cpp
#include "myheader.h"
void func2() {
    int value = globalVar; // Using the same external linkage variable
}
```

