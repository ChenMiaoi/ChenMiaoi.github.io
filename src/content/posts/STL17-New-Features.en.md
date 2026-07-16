---
slug: STL17-New-Features.en
title: 'STL17: New Features'
published: 2025-02-15
tags:
  - cpp
  - books
  - stl
category: cpp
lang: "en"
---
Before discussing the background of the C++ language, we first need to recognize a reality: due to domestic employment pressure and the relative conservatism of the IT industry, most C++ learners have not delved into the STL (Standard Template Library) or the newer C++ standards. Even though the C++23 standard has already been released, many C++ developers and learners still stick to more traditional programming styles, often mastering only `C with Class` or `C with Simple STL`, which means the potential of the C++ language has not been fully realized.

```cpp
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

The existence of this phenomenon hinders the learning and application of C++ to a certain extent, limiting developers' in-depth understanding and effective use of the language itself. As a multi-paradigm programming language, C++ should demonstrate far greater strengths in areas such as object-oriented programming, generic programming, and template metaprogramming. However, over-reliance on traditional programming patterns not only fails to showcase the true elegance of the C++ language, but may even cause developers to miss out on the many conveniences and performance optimizations offered by modern C++ when dealing with complex tasks.

Although the C++ language itself has seen issues such as feature bloat in recent years, these problems are not within the scope of this series. What needs to be made clear is that the evolution of the C++ language is still ongoing, and understanding and mastering the latest features of the language is crucial for improving a developer's abilities.

The goal of this series is to help developers who already have a foundation in C++ but have not yet deeply understood or applied the STL (Standard Template Library) and the various modern features of C++, so that they can master how to write more modern, effective, and efficient code with C++. If you have not yet learned C++, this series may not be suitable for you, because we assume that readers are already familiar with the basic syntax and common concepts of C++, and the goal is to enable you to make full use of the language's latest features to write high-quality code.

It is worth noting that many developers have some understanding of C++11, since classic books such as *C++ Primer* and *Effective C++* are based on C++11. However, since C++11 — especially after the release of C++14, C++17, and later standards — opportunities for in-depth learning and practice of these versions have been relatively scarce. Therefore, this series will start from C++17. Content prior to C++17 will only be elaborated on when necessary. If readers have questions about features before C++11, it is recommended to consult the relevant documentation on your own so that you can better follow along with this series.

--- 

## Structured Binding

In modern programming languages, destructuring (unpacking) has become one of the common features. For example, in Rust, you can conveniently destructure a tuple or a struct:

```rust
let tup = (1, "hello", 3.14);

let (a, b, c) = tup;
println!("a: {}, b: {}, c: {}", a, b, c);
```

In C++11, besides `std::tuple`, a very useful (?) function was introduced — `std::tie`. `std::tie` can bind the elements of a tuple to variables, thereby providing functionality similar to destructuring, although it differs syntactically from structured binding (`Structured Binding`). **The purpose of `std::tie` is to associate the elements of a tuple or struct with existing variables**, rather than directly creating new variables the way structured binding does.

```cpp
std::tuple<int, std::string, double> tup = {1, "hello", 3.14};

int a;
std::string b;
double c;
// 使用 std::tie 来解构元组
std::tie(a, b, c) = tup;
std::cout << "a: " << a << ", b: " << b << ", c: " << c << std::endl;
```

As you can see, std::tie requires us to plan out the type of each element and the corresponding local variables in advance before destructuring, which undoubtedly imposes certain limitations on coding efficiency and flexibility. Specifically, when using std::tie, you must explicitly specify the type of each variable, and these variables must already be declared before destructuring.

Moreover, `std::tie` does not support direct reference destructuring; you need to use `std::ref`, which also increases the difficulty of learning and coding.

```cpp
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

Therefore, to better support more convenient destructuring, C++17 introduced structured binding. With this syntactic sugar, C++ can destructure std::pair, std::tuple, structs, and arrays in a similar way:

```cpp
auto [var1, var2, ...] = <pair, tuple, struct, or array expression>;
```

- `std::pair` and `std::tuple`.
- `struct`: the struct's members must be non-static and defined in the same class.
- `array`: it must be a fixed-size array (i.e., its size is known at compile time).

Typically, we combine it with `auto` to automatically deduce the types. **Whenever conditions allow, use references as much as possible to reduce copies.**

```cpp
std::tuple<int, std::string, double> tup = {1, "hello", 3.14};
auto [a, b, c] = tup;  // 解构元组
std::cout << "a: " << a << ", b: " << b << ", c: " << c << std::endl;
```

> QUESTION: Many people may think that heavy use of destructuring (such as using structured binding to destructure tuples, std::pair, or other data structures) leads to performance problems, especially when return values are involved. Traditionally, C++ developers are accustomed to passing results through reference parameters (the "out parameter" pattern), believing that this avoids copy operations and improves efficiency. However, modern C++ compilers usually apply Return Value Optimization (RVO) or Named Return Value Optimization (NRVO) to return values, greatly reducing unnecessary copy overhead.  
> RVO and NRVO will be covered in a separate, dedicated chapter.

Of course, `structured binding` is not all advantages. Compared with `std::tie`, `structured binding` does not provide a direct mechanism to ignore certain elements of a tuple or struct, similar to `_` in Rust or `std::ignore`.

Therefore, you must explicitly declare a variable at every position to receive the values, even for values you simply do not care about.

### Action

In actual development, we frequently use `structured binding` in the following scenarios:

- `std::map` (which is actually `std::pair`)

```cpp
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

```cpp
std::tuple<int, double, std::string> get_values() {
    return {42, 3.14, "example"};
}

auto [x, y, z] = get_values();
std::cout << "x: " << x << ", y: " << y << ", z: " << z << std::endl;
```

- `error handling`

```cpp
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

Now let's briefly explain how structured binding is implemented. In the structured binding (`structured binding`) mechanism of `C++17`, the compiler generates a set of variables for the `identifier-list` ($v0, v1, v2, ...$) and binds them to the elements of the `initializer` (the initialization expression). The underlying implementation of this mechanism relies on `automatic type deduction` and `object destructuring`, with the following assumptions:

- Let `cv` denote the `cv-qualifiers`: the `cv` qualifiers (`const` and ~~volatile~~). *In C++20, this use of `volatile` has been removed*
- Let `S` denote the `storage-class specifiers` in the `decl-specifier-seq` (e.g., `static`)
- Let `A` denote the element type

1. When the assignment expression (`assignment-expression`) of the `initializer` is an array of type `cv A` with no reference qualifier (`ref-qualifier`), the structured binding behaves as follows:
$$
attribute-specifier-seqopt \ S \ cv \ A \ e ;
$$

```cpp
// Seem To:
const int arr[3] = {1, 2, 3};  // 这个数组类似 initializer
auto [x, y, z] = arr;

const int e[3] = arr;          // e 的声明方式类似于这里 attribute-specifier-seqopt S cv A e ;
auto& x = e[0];  // x 绑定到 e 的第 0 个元素
auto& y = e[1];  // y 绑定到 e 的第 1 个元素
auto& z = e[2];  // z 绑定到 e 的第 2 个元素
```

Here, **each element of `e` is copy-initialized or direct-initialized from the corresponding element of the `assignment-expression`, with the specific form determined by the form of the `initializer`**.

2. If the assignment expression (`assignment-expression`) of the `initializer` is not an array type, the structured binding behaves as follows:

$$
attribute-specifier-seqopt \ decl-specifier-seq \ ref-qualifieropt \ e = initializer ;
$$

- `attribute-specifier-seqopt` (optional attribute specifier sequence): allows the use of attributes (such as `[[nodiscard]]`)
- `decl-specifier-seq`: usually `auto`
- `ref-qualifier`: may be `&` or `&&`, indicating whether a reference is used

```cpp
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

In C++ code design, variable scope management is one of the key factors affecting code readability and maintainability. Good scope management not only helps avoid naming conflicts, but also reduces the interference of irrelevant variables with the code logic. Before C++17, developers often faced a common situation:

In C++ code, it is often necessary to make a conditional judgment on the result of some expression. For example, consider the following code:

```cpp
auto s = is_ok(something);
if (!s) {
    // error handling
}
...
```

In this code, `s` is only used for the condition of the if statement and has no actual use outside the `if` statement. However, since if statements before C++17 did not support defining variables in the condition part, s had to be declared in advance, thereby polluting the outer scope.

This unnecessary variable leakage can lead to:

- Name Clashes: repeatedly using variables with the same name within the same scope can increase code complexity and the burden on readability.
- Scope Pollution: some variables are only used within a specific statement block, but due to language limitations, their scope has to be elevated.
- Reduced Readability: readers need to pay attention to unnecessary variable definitions, reducing the intuitiveness of the code logic.

To improve code maintainability, modern C++ follows the principle of Minimizing Scope of Variables, i.e., "a variable's scope should be as small as possible, limited to the minimal range in which it is used."

The core ideas of this principle include:

- Localization: a variable's lifetime should be as short as possible to avoid misuse or unintentional modification.
- Encapsulation: confine variables to the smallest possible scope to reduce potential naming conflicts.
- Immediate Initialization: initialize a variable at the point of definition to reduce the risk of uninitialized variables.

Before C++17, since if statements did not support defining variables directly in the condition part, developers had to define extra variables before the if statement, causing scope expansion. Therefore, C++17 introduced a new feature to optimize this pattern.

C++17 introduced the init-statement for if statements, allowing developers to declare and initialize variables directly in the condition part of an if statement, thereby optimizing scope management. For example:

```cpp
if (auto s = is_ok(something); !s) {
    // error handling
}
...
```

### Action

In C++ code, the lifetime of a resource is usually bound to the scope of a variable — this is the core idea of RAII (Resource Acquisition Is Initialization). The RAII mechanism ensures that resources are acquired when an object is constructed and released when it is destructed. For example, in multithreaded programming, std::lock_guard<std::mutex> uses RAII to automatically manage the locking and unlocking of a mutex (std::mutex).

```cpp
// using if init-statement                                              // using traditional if 
if (std::lock_guard<std::mutex> lg {my_mutex}; some_condition) {        {
    // do something                                                         std::lock_guard<std::mutex> lg {my_mutex};
}                                                                           if (some_condition) {
                                                                                // do something
                                                                            }
                                                                        }
```

This pattern applies to any RAII-based resource management, such as:

- `std::unique_lock<std::mutex>` (supports more flexible lock management)
- `std::ifstream` (file stream closes automatically)
- `std::scoped_lock` (general-purpose multi-mutex management introduced in C++17)

### How To Work

In fact, the `if init-statement` is essentially a piece of basic syntactic sugar that can be equivalently transformed into the following form:

$$
\begin{aligned}
    &\texttt{if constexpr}_{opt} \ (\texttt{init-statement}_{opt} \ \texttt{condition}) \ \texttt{statement} = \\
    \{\\
        &\texttt{init-statement}_{opt} \\
        &\texttt{if constexpr}_{opt} \ (\texttt{condition}) \ \texttt{statement} \\
    \}
\end{aligned}
$$


This means the behavior of an if init-statement is equivalent to introducing a new scope {} before the if statement, executing the init-statement within it, and then evaluating the if condition. This transformation does not change the underlying semantics; it merely provides a more compact way of writing code, making the code more readable and better aligned with best practices for local scope management.

## Automatically deduce the resulting class type

## Constexpr

In modern programming, C++ has recognized that the introduction of compile-time constants can significantly reduce runtime computational burden, especially in frequently called scenarios, avoiding repeated runtime computation. Therefore, in C++11, C++ first introduced the `constexpr` keyword, which allows developers to explicitly declare that the value of a variable or function be evaluated at compile time, ensuring it is a constant expression, thereby enabling earlier optimization and stricter compile-time checks.

## Inline

In the C/C++ programming languages, the `inline` keyword is a well-known feature, and most developers have some understanding of its basic functionality. However, the differences between inline in C and inline in C++, as well as how inline semantics have changed as the C++ standard evolved, are rarely explored in depth.

### C Inline

First, we will explore in detail the definition and role of the inline keyword in C (since this series of tutorials mainly focuses on C++, we will only discuss up to the C11 standard).

As a first step, let's look at the role of inline in C:

- Improved execution efficiency: by eliminating function call overhead and reducing the stack operations of function calls; suitable for small functions.
- Better compiler optimization opportunities: allows the compiler to perform further optimizations, such as constant folding and dead code elimination.
- Improved code readability and maintainability: clearer than macros, type-safe, and easier to debug.

The C11 standard (ISO/IEC 9800:201x document) places clear constraints on the `inline` keyword:

- `inline` should only be used in the declaration of a function identifier.

```cpp
inline int x; // Error, inline specifier allowed on function declarations only
```

A definition of an inline function with external linkage shall not contain a definition of a modifiable object with static storage duration or thread storage duration, nor shall it reference an identifier with internal linkage.

1. Objects with static storage duration (such as static variables) or thread storage duration (such as thread_local variables) persist throughout program execution. An inline function may be expanded multiple times at different call sites; if such objects were allowed to be defined, it could lead to multiple copies or conflicts, thereby causing undefined behavior.

```cpp
inline void counter() {
    static int x = 0;
    x++;
}

note: use 'static' to give inline function 'counter' internal linkage
warning: non-constant static local variable in inline function may be different in different files
```

2. Identifiers with internal linkage (such as static functions or static global variables) are only visible within the current translation unit. If an inline function references such an identifier and that inline function is used by other translation units, it leads to linkage errors or undefined behavior.

```cpp
static int internal_var = 10;

inline void counter() {
    int y = internal_var;
}

warning: static variable 'internal_var' is used in an inline function with external linkage
```

**The purpose of these restrictions is to ensure that the behavior of inline functions remains consistent across different translation units and to avoid potential linkage or runtime problems. In actual testing, the compiler does not treat these as inline.**

- In a `hosted environment`, the declaration of the `main` function shall not contain any function specifier.

The standard explicitly prohibits the use of any function specifier in the declaration of the main function. This is because the calling and return mechanism of the main function is managed by the runtime environment, and any additional decoration could break its standard behavior.

> C Standard Enviroment
>
> The C language standard specifies two main execution environments:
>
>> Hosted Environment  
>> A complete C execution environment, usually relying on an operating system and providing full standard library support; program execution starts from the `main` function
>>
>> Freestanding Environment  
>> A simplified execution environment that does not depend on an operating system, typically used for embedded systems, operating system kernels, or bare-metal programs; the program's entry point is not necessarily the `main` function — it is implementation-defined

Any function with internal linkage may be an inline function. For functions with external linkage, the following restrictions apply:

If a function is declared inline, it must be defined in the same translation unit:

```cpp
static inline void func() {}
```

If, in a translation unit, all of the file-scope declarations of a function contain the inline function specifier and no extern, then the definition in that translation unit is an inline definition.

First, we need to understand what is meant by: **all of the file scope declarations for a function in a translation unit**

```cpp
// file1.c
inline void func(); // 
inline void func() {} //
```

```cpp
// file2.c
extern void func(); //
inline void func() {} //
```

An inline definition does not provide an external definition for the function, nor does it prohibit providing an external definition in another translation unit.

```cpp
// file1.c
inline void func() {}

// file2.c
void func() {}
```

An inline definition is an alternative to an external definition, which the compiler may use to implement calls to the function within the same translation unit. Whether a call to the function uses the inline definition or the external definition is unspecified.

---

#### Using C Inline

In C, the inline keyword is used to hint the compiler to expand a function inline, reducing the overhead of function calls. However, the behavior of inline is affected by the extern and static keywords, especially when it comes to the function's linkage. In actual development, many C developers usually prefer static inline, which is also the most common and recommended usage.

`static inline` is used to define inline functions with internal linkage. The scope of such a function is limited to the current translation unit; other translation units cannot access it. Because the function's scope is confined to the current translation unit, it will not conflict with functions of the same name in other translation units.

```cpp
// file1.c
static inline int add(int a, int b) {
    return a + b;
}
```

In the above code, the add function is only visible in file1.c; other translation units cannot call it. The compiler may choose to expand the add function inline to reduce function call overhead.

extern inline is used to define inline functions with external linkage. The scope of such a function is not limited to the current translation unit; other translation units can access it. However, when using extern inline, **you must ensure that a non-inline external definition is provided in another translation unit, so that the linker can correctly resolve references to the function**.

```cpp
// file1.c
extern inline int add(int a, int b) {
    return a + b;
}

// file2.c
int add(int a, int b) {
    return a + b;
}
```

In the above code, the add function in file1.c is an inline definition, and the compiler may choose to expand it inline. In file2.c, a non-inline external definition is provided to ensure that the linker can find the function.

**If you use the inline keyword alone without extern or static, its behavior is similar to extern inline, but the specific linkage is determined by the compiler. This usage may lead to uncertain behavior, especially when used across translation units. Therefore, to make the function's linkage explicit, it is recommended to explicitly specify either extern inline or static inline when using inline.**

By using static inline and extern inline appropriately, you can implement efficient inline functions in C while avoiding linkage conflicts and undefined behavior. In actual development, static inline, due to its simplicity and clear scope limitation, has become the most common and recommended usage.

> In practice, 99% of development will never use the strange `extern inline`.

---  

### C++ inline

#### C++98

The C++98 standard introduced the inline keyword, and many domestic C++ developers and learners transitioned from C to C++, so they may mistakenly believe that inline in C and inline in C++98 have the same functionality and identical usage. However, although the two are syntactically similar, their design goals and behaviors differ significantly.

In C, the inline keyword is mainly used as an optimization hint, encouraging the compiler to expand functions inline to reduce function call overhead. When the C99 standard introduced inline, it focused more on compatibility with C's compilation model and linkage rules. An inline function in C usually requires a non-inline external definition in some translation unit to ensure the linker can correctly resolve references to the function. In addition, C prohibits defining objects with static storage duration (such as static variables) in inline functions with external linkage, to avoid duplicate definition problems across multiple translation units.

In C++98, the inline keyword is not only an optimization hint but also a linkage mechanism. Its main goal is to support function definitions in header files and avoid linkage errors caused by repeatedly defining functions in multiple translation units. Therefore, in C++98, defining the same inline function in multiple translation units (usually via header files) is legal, and the linker ensures that only one instance is used. In addition, C++98 does not require explicitly providing a non-inline external definition; the compiler automatically handles the linkage of inline functions.

Moreover, C++98 allows defining objects with static storage duration (such as static variables) in inline functions, and these objects are shared across multiple translation units:

```cpp
inline int counter() {
    static int x = 0;
    return ++x;
}
```

In the above code, the static variable x is shared across multiple translation units, ensuring its uniqueness and consistency.

**It is worth noting that because C++ has the concept of `class`, within a fully defined `class/struct/union`, both member functions and friend functions are implicitly inline functions.**

For most C++ developers, the inline from C++98 discussed above has been carried over ever since (at that point inline mainly served as an indicator of whether the compiler should optimize); but after C++11, more emphasis was placed on inline functions being able to appear in multiple translation units without causing duplicate-definition linkage errors.

#### C++11

In C++11, the functionality of the inline keyword changed significantly. It is no longer mainly a reference indicator for the compiler to optimize functions; instead, it is used more to solve linkage problems, ensuring that inline functions can be defined repeatedly in multiple translation units without causing linkage errors. At the same time, C++11 carried over the C++98 rule of implicit inlining for class, struct, and union member functions — that is, member functions defined inside the class body have the inline attribute by default.

C++11 introduced the constexpr keyword for defining compile-time constant expression functions. A constexpr function implicitly has the inline attribute at its first definition, which means:

- constexpr functions can be defined in multiple translation units (usually via header files) without causing linkage errors.
- The compiler automatically handles the linkage of constexpr functions, with no need to explicitly provide a non-inline external definition.

```cpp
constexpr int add(int a, int b) {
    return a + b;
}
```

C++11 introduced the delete keyword for disabling certain member functions of a class (such as the copy constructor, copy assignment operator, etc.). Deleted functions implicitly have the inline attribute, so:

- The definition of a deleted function can appear in multiple translation units without causing linkage errors.
- This design solves the duplicate definition problem that = delete declarations might otherwise cause.

```cpp
class MyClass {
public:
    MyClass() = default;
    MyClass(const MyClass&) = delete;
};
```

As software scale grows, the likelihood of duplicate class names and function names increases significantly. To avoid naming conflicts, developers usually use namespaces to organize code. However, overly nested namespaces and the need for version control often lead developers to rely on macros or Symbol Prefix Overlay (SPO) to distinguish implementations of different versions.

```cpp
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

C++11 introduced `inline namespace`, providing a safer and more flexible solution for version control. The contents of an `inline namespace` are treated as part of the enclosing namespace, thereby simplifying version switching and symbol management.

```cpp
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

In C++17, considering that inline already ensures repeated definitions without causing linkage errors — while previous standards only provided the inline version for functions — if we want to declare a variable in a header file, we must use the following approach to declare and define it, and both parts are indispensable:

Before C++17, if you needed to declare a global variable in a header file, you had to use the extern keyword to declare the variable in the header file and provide the definition in some source file. For example:

```cpp
// In header
extern int x;

// In source
int x = 0;
```

This approach requires declaring and defining separately in the header file and the source file — both are indispensable, otherwise a linkage error occurs.

C++17 introduced inline variables, allowing global variables or class static member variables to be defined directly in header files without causing linkage errors. The specific rules are as follows:

- When the inline keyword is used in the decl-specifier-seq of a variable with static storage duration (such as a global variable or a static class member variable), it declares that variable as an inline variable.
- An inline variable can be defined repeatedly in multiple translation units, and the linker ensures that only one instance is used.

```cpp
inline int GLOBAL_VAR = 42;

class MyClass {
public:
    inline static int STATIC_VAR = 42;
};
```

This solves:

- Definition of global variables: with the inline keyword, global variables can be defined directly in header files without providing additional definitions in source files.
- Initialization of class static member variables: with the inline keyword, static member variables can be initialized directly inside the class without an out-of-class definition.
- Support for C++ header-only libraries: this feature removes a major obstacle in C++ header-only library development, making header-only library implementations more concise and efficient.

Moreover, C++17 also extended the functionality of the constexpr keyword so that it can be used with static data members. When a static data member is declared constexpr at its first declaration, it implicitly has the inline attribute. This means:

- A constexpr static data member can be initialized directly inside the class without an out-of-class definition.
- The static data member can be shared across multiple translation units without causing linkage errors.

```cpp
class MyClass {
public:
    static constexpr int STATIC_VAR = 42;
};
```

In C++17, the behavior of inline is specified more explicitly:

**The definitions of inline functions and variables need to be visible in the translation units that access them**. This rule ensures that the compiler can correctly expand functions inline or resolve variable definitions when needed.

**An inline function or variable can have multiple definitions, as long as each definition appears in a different translation unit and (for non-static inline functions and variables) all definitions are identical** — this is well-formed.

At namespace scope, an inline const variable has external linkage by default, while a non-inline const variable has internal linkage by default. Therefore, once `const inline` is defined, the original non-inline const variables all share the same inline definition, so no linkage error occurs.

```cpp
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
