---
title: 'ArkTS: analyze compiler_assembler'
mathjax: true
date: 2024-07-02 14:56:39
tags: [arkts, ospp]
categories: [arkts]
---

# ArkTS Assembler

在此次的任务中，我们主要是对于`riscv64`架构下的汇编进行处理，按照之前的经验来看，**目前已有的**`riscv64`**汇编代码处理逻辑是依托于**`aarch64`**而来**。因此，在本节中会详细解析两个部分：`assembler.h`和`assembler_aarch64`。

## Assembler

在这个小节中，我们会聚焦于`assembler.h`中的关键代码，并且给出后续`riscv64`可能的方向。

首先，在`assembler.h`中首先有一个名为`GCStackMapRegisters`的类，在`ArkTS`中，存在`GC`机制。因此，这里的`GCStackMapRegisters`**可能是用于垃圾回收机制中的栈映射寄存器。在垃圾回收算法中，栈映射寄存器用于记录程序执行过程中的栈帧信息，以便正确地识别和回收不再使用的对象。栈映射寄存器通常用于确定每个栈帧的边界和对象引用的位置。通过分析栈映射寄存器中的值，垃圾回收器可以构建出程序的栈帧结构，识别出栈中的对象引用，并进行相应的垃圾回收操作**。

``` cpp
class GCStackMapRegisters {
public:
#if defined(PANDA_TARGET_AMD64)
    static constexpr int SP = 7;  /* x7 */
    static constexpr int FP = 6;  /* x6 */
#elif defined(PANDA_TARGET_ARM64)
    static constexpr int SP = 31;  /* x31 */
    static constexpr int FP = 29;  /* x29 */
#elif defined(PANDA_TARGET_ARM32)
    static constexpr int SP = 13;  /* x13 */
    static constexpr int FP = 11;  /* x11 */
#elif defined(PANDA_TARGET_RISCV64)
    static constexpr int SP = 2;
    static constexpr int FP = 8;
#else
    static constexpr int SP = -1;
    static constexpr int FP = -1;
#endif
```

而在该内中的存在两个尚未完全的函数`GetFpRegByTriple`和`GetSpRegByTriple`，因为这两个函数中均未对`RISCV64`进行实现，因此可能在后续实现中，需要对其进行补全。

``` cpp
static int GetFpRegByTriple(Triple triple)
{
    int fp = -1;
    switch (triple) {
        case Triple::TRIPLE_AMD64:
            fp = 6;  /* x6 */
            break;
        case Triple::TRIPLE_ARM32:
            fp = 11;  /* x11 */
            break;
        case Triple::TRIPLE_AARCH64:
            fp = 29;  /* x29 */
            break;
        default:
            UNREACHABLE();
            break;
    }
    return fp;
}
```

而`GetFpRegByTriple`和`GetSpRegByTriple`唯一一次被调用则是位于`ecmascript/stackmap/llvm_stackmap_type.cpp`中。至于具体作用，如果后续需要则会继续分析。

``` cpp
auto fpReg = GCStackMapRegisters::GetFpRegByTriple(triple);
auto spReg = GCStackMapRegisters::GetSpRegByTriple(triple);
```

继续往下看，则会看见一段异常重要的代码`FrameCompletionPos`，(**根据自己的猜测**)**用于表示从`C++`代码到汇编代码的转换和从汇编代码返回到`C++`代码时的指令数量**。

``` cpp
enum FrameCompletionPos : uint64_t {
    // X64
    X64CppToAsmInterp = 28,
    X64AsmInterpToCpp = 9,
    X64EntryFrameDuration = 70,
    // ARM64
    ARM64CppToAsmInterp = 56,
    ARM64AsmInterpToCpp = 40,
    ARM64EntryFrameDuration = 116,
    // RISCV64
    RISCV64EntryFrameDuration = 140,
};
```

- 对于`X64(x86-64)`体系结构： 
  - `X64CppToAsmInterp` 表示从`C++`代码转换到汇编代码时的指令数量为 28。 
  - `X64AsmInterpToCpp` 表示从汇编代码返回到`C++`代码时的指令数量为 9。 
  - `X64EntryFrameDuration` 表示使用汇编解释器(`AsmInterpreterEntryFrame`)时的汇编帧的指令数量为 70。
- 对于`ARM64(ARM64)`体系结构： 
  - `ARM64CppToAsmInterp` 表示从`C++`代码转换到汇编代码时的指令数量为 56。 
  - `ARM64AsmInterpToCpp` 表示从汇编代码返回到`C++`代码时的指令数量为 40。 
  - `ARM64EntryFrameDuration` 表示使用汇编解释器时的汇编帧的指令数量为 116。
- 对于`RISCV64(RISC-V64)`体系结构： 
  - `RISCV64EntryFrameDuration` 表示使用汇编解释器时的汇编帧的指令数量为 140。

这里的代码实际上在我们处理`RISC-V64 Assembler`时没有影响，而是会在另外一个极其重要、并且需要我们处理的模块`stub trapoline`中进行使用，这里不做过多介绍：

``` cpp
if ((end - begin) != FrameCompletionPos::RISCV64EntryFrameDuration)
```

### Label

在这个部分中，主要介绍**用于处理汇编逻辑中的跳转指令的标签**。在`ArkTS`的运行时中使用一个名为`Label`的类进行标识：

``` cpp
class Label {
public:
    bool IsBound() const;
    bool IsLinked() const;
    bool IsLinkedNear() const;
    uint32_t GetPos() const;
    uint32_t GetLinkedPos() const;
    void BindTo(int32_t pos);
    void LinkTo(int32_t pos);
    void UnlinkNearPos();
    void LinkNearPos(uint32_t pos);
    uint32_t GetLinkedNearPos() const;

private:
    int32_t pos_ = 0;
    uint32_t nearPos_ = 0;
};
```

首先我们需要区分两个概念：`绑定(bound)`和`链接(link)`。在`ArkTS`中，绑定和链接是两个相似，但行为不同的操作：

- `bound`指的是**将标签绑定到特定的位置。绑定标签意味着将标签与某个位置相关联，*通常用于表示位于后面的标签***。
- `link`指的是**将标签链接到特定的位置。链接标签意味着将标签与某个位置相关联，*通常用于表示位于前面的标签***。

这里我们可以使用实际的汇编代码进行解释：

``` asm
; 绑定标签示例
section .text
    global _start

_start:             ; 链接的位置
    ; 绑定标签到位置
    jmp bind_label

bind_label:
    ; 这里是绑定的位置
    ; ...
    jmp _start       ; 链接回起始位置

    ; 继续执行其他代码...
```

现在来解释各个函数的作用：

- `IsBound()` 函数用于检查标签是否已绑定。如果 $pos_ \gt 0$，则表示标签已绑定。
- `IsLinked()` 函数用于检查标签是否已链接。如果 $pos_ \lt 0$，则表示标签已链接。 
- `IsLinkedNear()` 函数用于检查标签是否已链接至近跳转位置。如果 $nearPos_ \gt 0$，则表示标签已链接至近跳转位置。 
- `GetPos()` 函数用于获取标签的位置。返回 $pos_ - 1$ 的无符号整数值。 
- `GetLinkedPos()` 函数用于获取链接的位置。如果标签未绑定，则返回 $-pos_ - 1$ 的无符号整数值。 
- `BindTo()` 函数将标签绑定到给定的位置。将 `pos_` 设置为 $pos + 1$，以跳过偏移为 0 的位置。 
- `LinkTo()` 函数将标签链接到给定的位置。将 `pos_` 设置为 $-(pos + 1)$，以跳过偏移为 0 的位置。 
- `UnlinkNearPos()` 函数取消链接至近跳转位置。 
- `LinkNearPos()` 函数将标签链接至近跳转位置。将 `nearPos_` 设置为 $pos + 1$，以跳过偏移为 0 的位置。 
- `GetLinkedNearPos()` 函数用于获取链接至近跳转位置的位置。如果标签未绑定，则返回 $nearPos_ - 1$ 的无符号整数值。

### Assembler

接下来则是整个`assembler.h`中最为重要的模块，所有架构的汇编处理逻辑都需要继承于`Assembler`。

``` cpp
class Assembler {
public:
    explicit Assembler(Chunk *chunk)
        : buffer_(chunk) {}
    ~Assembler() = default;

    void EmitU8(uint8_t v);
    void EmitI8(int8_t v);
    void EmitU16(uint16_t v);
    void EmitU32(uint32_t v);
    void EmitI32(int32_t v);
    void EmitU64(uint64_t v);
    void PutI8(size_t offset, int8_t data);
    void PutI32(size_t offset, int32_t data);
    uint32_t GetU32(size_t offset) const;
    int8_t GetI8(size_t offset) const;
    uint8_t GetU8(size_t offset) const;
    size_t GetCurrentPosition() const;
    uint8_t *GetBegin() const;
    static bool InRangeN(int32_t x, uint32_t n);
    static bool InRange8(int32_t x);
    static void GetFrameCompletionPos(uint64_t &headerSize, uint64_t &tailSize, uint64_t &entryDuration);
private:
    DynChunk buffer_;
};
```

在`Assembler`中，`buffer_`**用于存储汇编的机器码**，而`Emit*`则是会调用`buffer_.Emit*`进行处理逻辑，这样能够根据汇编的机器码依次正确地存入内存中，以便后续处理。

比如：在`X64`架构中的`Assembler::Addq`，其要处理的汇编为：`REX.W + 03 /r`。这里需要注意的是，你应该知晓`x64`架构下汇编的格式为：

![intel x64 asm](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407021625400.png)

因此，首先我们需要处理`Instruction Prefixes`，然后处理`Opcode`，最后处理`ModR/M`。因为这里不需要处理`SIB`。我们重新看回`REX.W + 03 /r`，其中`REX.W`是`Instruction Prefixes`，`03`是`Opcode`，而`/r`则是`ModR/M`。而每一个段在此处都是一个字节，因此：

``` cpp
void AssemblerX64::Addq(Register src, Register dst)
{
    EmitRexPrefix(dst, src);
    // 03 : add r64, r/m64
    EmitU8(0x03);
    EmitModrm(dst, src);
}

void EmitRexPrefix(Register reg, Register rm)
{
    // 0: Extension to the MODRM.rm field B
    // 2: Extension to the MODRM.reg field R
    EmitU8(REX_PREFIX_W | (HighBit(reg) << 2) | HighBit(rm));
}

void EmitModrm(int32_t reg, Register rm)
{
    EmitU8(MODE_RM | (static_cast<uint32_t>(reg) << LOW_BITS_SIZE) | LowBits(rm));
}
```

至此，我们能够看见，`Assembler`中的任何处理逻辑，都是依托于其真实汇编的机器码逻辑，并且根据其真实字节位宽进行处理，就比如`EmitU8`则是填入`uint8_t`。

至于`Put*`，此处不做过多介绍，其实际内部逻辑也是进行填入操作，但是会直接通过偏移量进行填入，需要我们自行保证其边界问题和内存安全问题。

``` cpp
inline void PutU32(size_t offset, uint32_t data) const
{
    // NOLINTNEXTLINE(cppcoreguidelines-pro-bounds-pointer-arithmetic)
    *reinterpret_cast<uint32_t *>(buf_ + offset) = data;
}
```

## Aarch64 Assembler Detail

这一个小节主要是介绍`aarch64`架构下的汇编处理逻辑，因为`RISC-V64`架构大部分逻辑是临摹`aarch64`架构所写，因此分析`aarch64`的完整逻辑对后续开发有很大帮助。

