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

### Register

处理一个汇编首先需要解决的问题是，**如何处理对应架构汇编下的对应寄存器**。在`aarch64`中有两组寄存器：通用寄存器和`SIMD`寄存器。

#### General Purpose Register

通用寄存器中的$31$个通用寄存器被命名为$R_0-R_{30}$，并在指令寄存器字段中以值$0-30$进行编码。在通用寄存器字段中，**值$31$表示当前的堆栈指针或零寄存器**，具体取决于指令和操作数位置。

![Naming of general-purpose registers](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031538142.png)

对于上图所给出的寄存器，这里有几个点需要注意的：

- $X_n$和$W_n$实际上指向的是同一组寄存器$R_n$，其只有位宽的差距；当然$WSP$和$SP$也是类似的情况。
- 没有名为$W_{31}$或$X_{31}$的寄存器，使用$WZR$或$XZR$来表示第$31$号的零寄存器，当读写该寄存器时，其表现为返回零值或抛弃写入值。

``` cpp
enum RegisterId : uint8_t {
    X0, X1, X2, X3, X4, X5, X6, X7,
    X8, X9, X10, X11, X12, X13, X14, X15,
    X16, X17, X18, X19, X20, X21, X22, X23,
    X24, X25, X26, X27, X28, X29, X30, SP,
    Zero = SP,
    FP = X29,
    INVALID_REG = 0xFF,
};

enum RegisterType {
    W = 0,    // 32-bits
    X = 1,    // 64-bits
};

static const int RegXSize = 64;
static const int RegWSize = 32;
```

值得注意的是，在`arm`中$SP = 31，ZERO = 31，FP = 29$。

##### General Condition

![General Condition](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031629956.png)

``` cpp
enum Condition {
    EQ = 0,
    NE = 1,
    HS = 2,
    CS = HS,
    LO = 3,
    CC = LO,
    MI = 4,
    PL = 5,
    VS = 6,
    VC = 7,
    HI = 8,
    LS = 9,
    GE = 10,
    LT = 11,
    GT = 12,
    LE = 13,
    AL = 14,
    NV = 15,
};
```

#### Register Code

``` cpp
class Register {
public:
    Register(RegisterId reg, RegisterType type = RegisterType::X) : reg_(reg), type_(type) {};

    Register W() const;
    Register X() const;
    
    RegisterType GetType() const;
    inline RegisterId GetId() const;
    
    inline bool IsSp() const;
    inline bool IsW() const;
    inline bool IsValid() const;
    
    inline bool operator !=(const Register &other);
    inline bool operator ==(const Register &other);

private:
    RegisterId reg_;
    RegisterType type_;
};
```

这里不需要过多的解释，根据上面的所有信息就能够自然的构建出这样的一个`Register`类型。

#### SIMD Register

在`aarch`下的`SIMD`寄存器总共有$32$个，$V_0 - V_{31}$，**其用于保存标量(scalar)浮点指令的浮点操作数以及`SIMD`指令的标量(scalar)和矢量(vector)操作数**。

**当它们以特定的指令形式使用时，必须进一步限定名称以指示数据形状，即数据元素大小和寄存器内元素或通道的数量**。数据类型由对数据进行操作的指令助记符描述。数据类型不是由寄存器名描述的。数据类型是对每个寄存器或向量元素中的位的解释，无论这些是整数、浮点值、多项式还是加密哈希。

![SIMD and floating-point](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031601724.png)

上图中的左图表示了`SIMD`的标量寄存器名，**其指定了操作标量数据时只访问高级`SIMD`和浮点寄存器的低位。未使用的高位在读取时会被忽略，在写入时会被清零**。

而右图表示向量寄存器名，在一开始我们就说过：**必须进一步限定名称以指示数据形状**，也就是说，这里就给出了向量寄存器的数据形状，即数据元素大小和内部通道的数量。其中$V_n$在$V_0 - V_31$中。

``` cpp
enum VectorRegisterId : uint8_t {
    v0, v1, v2, v3, v4, v5, v6, v7,
    v8, v9, v10, v11, v12, v13, v14, v15,
    v16, v17, v18, v19, v20, v21, v22, v23,
    v24, v25, v26, v27, v28, v29, v30, v31,
    INVALID_VREG = 0xFF,
};

enum Scale {
    B = 0,
    H = 1,
    S = 2,
    D = 3,
    Q = 4,
};
```

#### SIMD Code

``` cpp
class VectorRegister {
public:
    explicit VectorRegister(VectorRegisterId reg, Scale scale = D) : reg_(reg), scale_(scale) {};

    inline VectorRegisterId GetId() const;
    inline bool IsValid() const;
    inline Scale GetScale() const;
    inline int GetRegSize() const;

private:
    VectorRegisterId reg_;
    Scale scale_;
};
```

### Operand

在`aarch`中，`Operand`的类型可以大致分为两类：`Data Processing`和`Load and Store`。为了处理这两种类型，我们在实际代码编写中需要构建两个类：`Operand`和`MemoryOperand`。其中，这两个类会由`Register`、`Immediate`、`Extend`、`Shift`和`AddrMode`分别构成。

对于`Register`类型这里就不再赘述，其主要**管理了寄存器的编号和类型**，如果是向量寄存器，则会额外管理`标量(scalar)`。

对于`Immediate`类型而言，只是一个最为简单的数据封装，分为`Immediate`和`LogicImmediate`：

``` cpp
class Immediate {
public:
    Immediate(int64_t value) : value_(value) {}
    ~Immediate() = default;

    int64_t Value() const;
    
private:
    int64_t value_;
};

class LogicalImmediate {
public:
    static LogicalImmediate Create(uint64_t imm, int width);
    int Value() const;

    bool IsValid() const;
    bool Is64bit() const;
private:
    explicit LogicalImmediate(int value)
        : imm_(value) {}
    static const int InvalidLogicalImmediate = -1;
    int imm_;
};
```

而`Extend`则是作为`Immediate`的扩展类型指导，**用于标记是否需要进行立即数扩展和以哪一种方式进行扩展**。

``` cpp
enum Extend : uint8_t {
    NO_EXTEND = 0xFF,
    UXTB = 0,   /* zero extend to byte */
    UXTH = 1,   /* zero extend to half word */
    UXTW = 2,   /* zero extend to word */
    UXTX = 3,   /* zero extend to 64bit */
    SXTB = 4,   /* sign extend to byte */
    SXTH = 5,   /* sign extend to half word */
    SXTW = 6,   /* sign extend to word */
    SXTX = 7,   /* sign extend to 64bit */
};
```

对于`Shift`，是作为对应了位移和旋转操作(逻辑位移、算数位移、旋转以及条件性移动指令)：

``` cpp
enum Shift : uint8_t {
    NO_SHIFT = 0xFF,
    LSL = 0x0,  // 逻辑左移
    LSR = 0x1,  // 逻辑右移
    ASR = 0x2,  // 算术右移
    ROR = 0x3,  // 旋转
    MSL = 0x4,  // 条件性移动
};
```

对于`AddrMode`来说，**用于内存访问指令的寻址模式**。

``` cpp
enum  AddrMode {
    OFFSET,
    PREINDEX,
    POSTINDEX
};
```

- `OFFSET`：仅计算偏移量，但不更新基地址寄存器。
- `PREINDEX`：在访问之前计算偏移量并更新基地址寄存器。
- `POSTINDEX`：在访问之后计算偏移量并更新基地址寄存器。

``` asm
; OFFSET
LDR X0, [X1, #8]    ; 从地址 X1 + 8 处加载数据到 X0 寄存器
; PREINDEX
LDR X0, [X1, #8]!   ; 从地址 X1 + 8 处加载数据到 X0 寄存器，并更新 X1 为 X1 + 8
; POSTINDEX
LDR X0, [X1], #8    ; 从地址 X1 处加载数据到 X0 寄存器，并在加载后将 X1 更新为 X1 + 8
```

由这些组合而成的`Operand`能够为之后`Assembler`提供相应的操作数，这样能够避免过多冗余数据的产生。

#### Data Operand

``` cpp
class Operand {
public:
    Operand(Immediate imm)
        : reg_(RegisterId::INVALID_REG), extend_(Extend::NO_EXTEND), shift_(Shift::NO_SHIFT),
          shiftAmount_(0), immediate_(imm) {}
    Operand(Register reg, Shift shift = Shift::LSL, uint8_t shift_amount = 0)
        : reg_(reg), extend_(Extend::NO_EXTEND), shift_(shift), shiftAmount_(shift_amount), immediate_(0) {}
    Operand(Register reg, Extend extend, uint8_t shiftAmount = 0)
        : reg_(reg), extend_(extend), shift_(Shift::NO_SHIFT), shiftAmount_(shiftAmount), immediate_(0) {}
    ~Operand() = default;

    inline bool IsImmediate() const;
    inline bool IsShifted() const;
    inline bool IsExtended() const;

    inline Register Reg() const;
    inline Shift GetShiftOption() const;
    inline Extend GetExtendOption() const;
    inline uint8_t GetShiftAmount() const;
    inline int64_t ImmediateValue() const;
    inline Immediate GetImmediate() const;

private:
    Register reg_;
    Extend  extend_;
    Shift  shift_;
    uint8_t  shiftAmount_;
    Immediate immediate_;
};

```

#### Memory Operand

``` cpp
class MemoryOperand {
public:
    MemoryOperand(Register base, Register offset, Extend extend, uint8_t  shiftAmount = 0)
        : base_(base), offsetReg_(offset), offsetImm_(0), addrmod_(AddrMode::OFFSET),
          extend_(extend), shift_(Shift::NO_SHIFT), shiftAmount_(shiftAmount) {}
    MemoryOperand(Register base, Register offset, Shift shift = Shift::NO_SHIFT, uint8_t  shiftAmount = 0)
        : base_(base), offsetReg_(offset), offsetImm_(0), addrmod_(AddrMode::OFFSET),
          extend_(Extend::NO_EXTEND), shift_(shift), shiftAmount_(shiftAmount) {}
    MemoryOperand(Register base, int64_t offset, AddrMode addrmod = AddrMode::OFFSET)
        : base_(base), offsetReg_(RegisterId::INVALID_REG), offsetImm_(offset), addrmod_(addrmod),
          extend_(Extend::NO_EXTEND), shift_(Shift::NO_SHIFT), shiftAmount_(0) {}
    ~MemoryOperand() = default;

    Register GetRegBase() const;
    bool IsImmediateOffset() const;
    Immediate GetImmediate() const;
    AddrMode GetAddrMode() const;
    Extend GetExtendOption() const;
    Shift GetShiftOption() const;
    uint8_t GetShiftAmount() const;
    Register GetRegisterOffset() const;

private:
    Register base_;
    Register offsetReg_;
    Immediate offsetImm_;
    AddrMode addrmod_;
    Extend extend_;
    Shift shift_;
    uint8_t shiftAmount_;
};
```

这里与`Operand`不同的是，因为`aarch64`是以基址作为跳转的，因此我们需要一个基址寄存器和一个偏移量(这个偏移量可能是寄存器值也可能是立即数值)。还需要通过`AddrMode`来判断具体的寻址模式。

### Assembler Implement

在前面讲解`assembler.h`时，我有提到：**所有的实际架构的汇编都是基于`Assembler`的，因此，我们实际上是要对`buffer_`进行操作，对数据进行处理后，写入实际的汇编对应的机器码**。

``` cpp
class AssemblerAarch64 : public Assembler;
```

#### Add