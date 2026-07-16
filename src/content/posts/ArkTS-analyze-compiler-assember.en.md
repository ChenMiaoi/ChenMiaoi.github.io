---
slug: ArkTS-analyze-compiler-assember.en
title: 'ArkTS: analyze compiler_assembler'
published: 2024-07-04
tags:
  - arkts
  - ospp
category: arkts
series: arkts
lang: "en"
---
In this task, we mainly deal with assembly under the `riscv64` architecture. Based on previous experience, **the existing**`riscv64`**assembly code processing logic is derived from**`aarch64`. Therefore, in this section we will analyze two parts in detail: `assembler.h` and `assembler_aarch64`.

## Assembler

In this section, we will focus on the key code in `assembler.h` and point out possible directions for the subsequent `riscv64` work.

First, in `assembler.h` there is a class named `GCStackMapRegisters`. In `ArkTS`, there is a `GC` mechanism. Therefore, the `GCStackMapRegisters` here **is likely used for stack map registers in the garbage collection mechanism. In garbage collection algorithms, stack map registers record stack frame information during program execution so that objects that are no longer in use can be correctly identified and reclaimed. Stack map registers are typically used to determine the boundaries of each stack frame and the locations of object references. By analyzing the values in the stack map registers, the garbage collector can reconstruct the program's stack frame structure, identify object references on the stack, and perform the corresponding garbage collection operations**.

```cpp
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

Within this class there are also two incomplete functions, `GetFpRegByTriple` and `GetSpRegByTriple`. Since neither of them implements `RISCV64`, they may need to be completed in future work.

```cpp
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

The only place where `GetFpRegByTriple` and `GetSpRegByTriple` are called is in `ecmascript/stackmap/llvm_stackmap_type.cpp`. As for their specific purpose, we will analyze it further if needed later.

```cpp
auto fpReg = GCStackMapRegisters::GetFpRegByTriple(triple);
auto spReg = GCStackMapRegisters::GetSpRegByTriple(triple);
```

Continuing downward, we come to an extremely important piece of code, `FrameCompletionPos`, which (**based on my own guess**) **represents the number of instructions involved when transitioning from `C++` code to assembly code and when returning from assembly code back to `C++` code**.

```cpp
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

- For the `X64(x86-64)` architecture: 
  - `X64CppToAsmInterp` indicates that the number of instructions when transitioning from `C++` code to assembly code is 28. 
  - `X64AsmInterpToCpp` indicates that the number of instructions when returning from assembly code to `C++` code is 9. 
  - `X64EntryFrameDuration` indicates that the number of instructions of the assembly frame when using the assembly interpreter (`AsmInterpreterEntryFrame`) is 70.
- For the `ARM64(ARM64)` architecture: 
  - `ARM64CppToAsmInterp` indicates that the number of instructions when transitioning from `C++` code to assembly code is 56. 
  - `ARM64AsmInterpToCpp` indicates that the number of instructions when returning from assembly code to `C++` code is 40. 
  - `ARM64EntryFrameDuration` indicates that the number of instructions of the assembly frame when using the assembly interpreter is 116.
- For the `RISCV64(RISC-V64)` architecture: 
  - `RISCV64EntryFrameDuration` indicates that the number of instructions of the assembly frame when using the assembly interpreter is 140.

This code actually has no effect when we work on the `RISC-V64 Assembler`; instead, it is used in another extremely important module that we need to handle, `stub trapoline`, which we will not elaborate on here:

```cpp
if ((end - begin) != FrameCompletionPos::RISCV64EntryFrameDuration)
```

### Label

In this part, we mainly introduce **the labels used to handle jump instructions in assembly logic**. In the `ArkTS` runtime, they are represented by a class named `Label`:

```cpp
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

First, we need to distinguish two concepts: `bound` and `link`. In `ArkTS`, bound and link are two similar operations with different behaviors:

- `bound` refers to **binding a label to a specific position. Binding a label means associating the label with a certain position, *usually used to denote a label located later***.
- `link` refers to **linking a label to a specific position. Linking a label means associating the label with a certain position, *usually used to denote a label located earlier***.

Here we can explain with actual assembly code:

```asm
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

Now let's explain the role of each function:

- The `IsBound()` function checks whether the label has been bound. If $pos_ \gt 0$, the label is bound.
- The `IsLinked()` function checks whether the label has been linked. If $pos_ \lt 0$, the label is linked. 
- The `IsLinkedNear()` function checks whether the label has been linked to a near jump position. If $nearPos_ \gt 0$, the label has been linked to a near jump position. 
- The `GetPos()` function gets the position of the label. It returns the unsigned integer value of $pos_ - 1$. 
- The `GetLinkedPos()` function gets the linked position. If the label is not bound, it returns the unsigned integer value of $-pos_ - 1$. 
- The `BindTo()` function binds the label to the given position. It sets `pos_` to $pos + 1$ to skip the position with offset 0. 
- The `LinkTo()` function links the label to the given position. It sets `pos_` to $-(pos + 1)$ to skip the position with offset 0. 
- The `UnlinkNearPos()` function removes the link to the near jump position. 
- The `LinkNearPos()` function links the label to the near jump position. It sets `nearPos_` to $pos + 1$ to skip the position with offset 0. 
- The `GetLinkedNearPos()` function gets the position linked to the near jump position. If the label is not bound, it returns the unsigned integer value of $nearPos_ - 1$.

### Assembler

Next comes the most important module in all of `assembler.h`; the assembly processing logic of every architecture must inherit from `Assembler`.

```cpp
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

In `Assembler`, `buffer_` **is used to store the machine code of the assembly**, while `Emit*` calls `buffer_.Emit*` to perform the processing logic, so that the machine code of the assembly can be correctly stored into memory in order for subsequent processing.

For example, `Assembler::Addq` in the `X64` architecture processes the assembly `REX.W + 03 /r`. Note that you should be familiar with the assembly format under the `x64` architecture:

![intel x64 asm](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407021625400.png)

Therefore, we first need to handle the `Instruction Prefixes`, then the `Opcode`, and finally the `ModR/M`, because the `SIB` does not need to be handled here. Looking back at `REX.W + 03 /r`, `REX.W` is the `Instruction Prefixes`, `03` is the `Opcode`, and `/r` is the `ModR/M`. Each segment here is one byte, so:

```cpp
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

At this point, we can see that all processing logic in `Assembler` relies on the machine code logic of the real assembly and is handled according to its real byte width; for example, `EmitU8` writes a `uint8_t`.

As for `Put*`, we will not go into detail here. Its internal logic also performs a write operation, but it writes directly through an offset, so we need to guarantee the boundary and memory safety issues ourselves.

```cpp
inline void PutU32(size_t offset, uint32_t data) const
{
    // NOLINTNEXTLINE(cppcoreguidelines-pro-bounds-pointer-arithmetic)
    *reinterpret_cast<uint32_t *>(buf_ + offset) = data;
}
```

## Aarch64 Assembler Detail

This section mainly introduces the assembly processing logic under the `aarch64` architecture. Because most of the `RISC-V64` architecture logic is written by imitating the `aarch64` architecture, analyzing the complete logic of `aarch64` is very helpful for subsequent development.

### Register

The first problem to solve when handling assembly is **how to handle the corresponding registers of the corresponding architecture's assembly**. In `aarch64` there are two groups of registers: general-purpose registers and `SIMD` registers.

#### General Purpose Register

The $31$ general-purpose registers are named $R_0-R_{30}$ and are encoded with values $0-30$ in the instruction register field. In the general-purpose register field, **the value $31$ represents the current stack pointer or the zero register**, depending on the instruction and the operand position.

![Naming of general-purpose registers](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031538142.png)

For the registers given in the figure above, there are a few points to note:

- $X_n$ and $W_n$ actually point to the same set of registers $R_n$; they differ only in bit width. Of course, $WSP$ and $SP$ are a similar case.
- There is no register named $W_{31}$ or $X_{31}$; $WZR$ or $XZR$ is used to represent the zero register number $31$. When this register is read or written, it behaves by returning zero or discarding the written value.

```cpp
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

It is worth noting that in `arm`, $SP = 31，ZERO = 31，FP = 29$.

##### General Condition

![General Condition](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031629956.png)

```cpp
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

```cpp
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

No excessive explanation is needed here; based on all the information above, such a `Register` type can be constructed naturally.

#### SIMD Register

There are $32$ `SIMD` registers under `aarch`, $V_0 - V_{31}$, **which are used to hold the floating-point operands of scalar floating-point instructions and the scalar and vector operands of `SIMD` instructions**.

**When they are used in a specific instruction form, the name must be further qualified to indicate the data shape, i.e. the data element size and the number of elements or lanes within the register**. The data type is described by the mnemonic of the instruction operating on the data. The data type is not described by the register name. The data type is an interpretation of the bits in each register or vector element, whether they are integers, floating-point values, polynomials, or cryptographic hashes.

![SIMD and floating-point](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407031601724.png)

The left diagram in the figure above shows the scalar register names of `SIMD`, **which specify that when operating on scalar data, only the lower bits of the advanced `SIMD` and floating-point registers are accessed. The unused upper bits are ignored when read and cleared to zero when written**.

The right diagram shows the vector register names. As we said at the very beginning: **the name must be further qualified to indicate the data shape** — that is, the data shape of the vector register is given here, i.e. the data element size and the number of internal lanes. Here $V_n$ is within $V_0 - V_31$.

```cpp
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

```cpp
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

In `aarch`, `Operand` types can be roughly divided into two categories: `Data Processing` and `Load and Store`. To handle these two types, we need to build two classes in the actual code: `Operand` and `MemoryOperand`. These two classes are composed of `Register`, `Immediate`, `Extend`, `Shift`, and `AddrMode`, respectively.

The `Register` type will not be repeated here; it mainly **manages the register number and type**, and if it is a vector register, it additionally manages the `scalar`.

As for the `Immediate` type, it is just the simplest data encapsulation, divided into `Immediate` and `LogicImmediate`:

```cpp
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

`Extend` serves as the extension type guide for `Immediate`, **used to mark whether an immediate extension is required and in which way to extend**.

```cpp
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

As for `Shift`, it corresponds to shift and rotate operations (logical shift, arithmetic shift, rotate, and conditional move instructions):

```cpp
enum Shift : uint8_t {
    NO_SHIFT = 0xFF,
    LSL = 0x0,  // 逻辑左移
    LSR = 0x1,  // 逻辑右移
    ASR = 0x2,  // 算术右移
    ROR = 0x3,  // 旋转
    MSL = 0x4,  // 条件性移动
};
```

As for `AddrMode`, it is **used for the addressing modes of memory access instructions**.

```cpp
enum  AddrMode {
    OFFSET,
    PREINDEX,
    POSTINDEX
};
```

- `OFFSET`: only computes the offset, but does not update the base address register.
- `PREINDEX`: computes the offset and updates the base address register before the access.
- `POSTINDEX`: computes the offset and updates the base address register after the access.

```asm
; OFFSET
LDR X0, [X1, #8]    ; 从地址 X1 + 8 处加载数据到 X0 寄存器
; PREINDEX
LDR X0, [X1, #8]!   ; 从地址 X1 + 8 处加载数据到 X0 寄存器，并更新 X1 为 X1 + 8
; POSTINDEX
LDR X0, [X1], #8    ; 从地址 X1 处加载数据到 X0 寄存器，并在加载后将 X1 更新为 X1 + 8
```

The `Operand` composed of these can provide corresponding operands for the subsequent `Assembler`, thus avoiding the generation of too much redundant data.

#### Data Operand

```cpp
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

```cpp
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

The difference from `Operand` here is that because `aarch64` jumps based on a base address, we need a base register and an offset (this offset may be a register value or an immediate value). We also need `AddrMode` to determine the specific addressing mode.

### Assembler Implement

When explaining `assembler.h` earlier, I mentioned: **the assembly of every real architecture is based on `Assembler`; therefore, what we actually do is operate on `buffer_`, process the data, and write the machine code corresponding to the real assembly**.

```cpp
class AssemblerAarch64 : public Assembler;
```

Another point to note: when `ArkTS` implements `aarch64`, macros are used to define data such as the fields, bit widths, and masks of the instruction set:

```cpp
#define DECL_FIELDS_IN_INSTRUCTION(INSTNAME, FIELD_NAME, HIGHBITS, LOWBITS) \
static const uint32_t INSTNAME##_##FIELD_NAME##_HIGHBITS = HIGHBITS;  \
static const uint32_t INSTNAME##_##FIELD_NAME##_LOWBITS = LOWBITS;    \
static const uint32_t INSTNAME##_##FIELD_NAME##_WIDTH = ((HIGHBITS - LOWBITS) + 1); \
static const uint32_t INSTNAME##_##FIELD_NAME##_MASK = (((1 << INSTNAME##_##FIELD_NAME##_WIDTH) - 1) << LOWBITS);

#define DECL_INSTRUCTION_FIELDS(V)  \
    COMMON_REGISTER_FIELD_LIST(V)   \
    LDP_AND_STP_FIELD_LIST(V)       \
    LDR_AND_STR_FIELD_LIST(V)       \
    MOV_WIDE_FIELD_LIST(V)          \
    BITWISE_OP_FIELD_LIST(V)        \
    ADD_SUB_FIELD_LIST(V)           \
    COMPARE_OP_FIELD_LIST(V)        \
    BRANCH_FIELD_LIST(V)            \
    BRK_FIELD_LIST(V)
    
#define COMMON_REGISTER_FIELD_LIST(V)   \
    V(COMMON_REG, Rd, 4, 0)             \
    V(COMMON_REG, Rn, 9, 5)             \
    V(COMMON_REG, Rm, 20, 16)           \
    V(COMMON_REG, Rt, 4, 0)             \
    V(COMMON_REG, Rt2, 14, 10)          \
    V(COMMON_REG, Sf, 31, 31)
```

#### Add && Sub

In `aarch64`, `add` and `sub` are a pair of almost identical instructions. Therefore, we mainly explain `add`. `add` has two types: `add` and `adds` (we do not consider the implementation of `addg`). Each of `add` and `adds` has three cases: `extend register`, `immediate`, and `shifted register`.

##### add(extend register)

The `Add(extended register)` **instruction adds a register value and a sign-extended or zero-extended register value, optionally with a left shift, and writes the result to the destination register**. The argument extended from the `<Rm>` register can be a byte, halfword, word, or doubleword.

![add extended register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041036158.png)

The data width of the instruction can be determined from the `sf` bit:

- If $sf = 0$, it indicates $32bits$:
  - `ADD <Wd|WSP>, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}`
- If $sf = 1$, it indicates $64bits$:
  - `ADD <Xd|SP>, <Xn|SP>, <R><m>{, <extend> {#<amount>}}`

For `*d`, it serves as the destination register, while `*n` is the first source register. And `*m` is naturally the second source register. For the instruction format under $64bits$, `<R>` denotes the register prefix and `<m>` denotes its register number:

| `<R>` |     code     |
|:-----:|:------------:|
|   W   | option = 00x |
|   W   | option = 010 |
|   X   | option = x11 |
|   W   | option = 10x | 
|   W   | option = 110 | 

As for `<extend>`, it is related to the `Extend` implementation; if needed, search upward for `Extend` yourself or consult the relevant manual.

If the `Rd` or `Rn` register is $11111$, i.e. `WSP`: when the instruction is $32bits$ and $option = 010$, `LSL` is used as the extension; if it is $64bits$ and $option = 011$, `LSL` is used as the extension. But if $imm3 = 000$, it can be omitted; otherwise, `<extend>` is mandatory in other cases. And when $option = 010$ ($32bits$), it must also be extended with `UXTW`; when $option = 011$ (64bits), it is extended with `UXTW`.

`<amount>` is related to the `imm3` field; it is the appropriate offset for the left shift, in the range $0 - 4$ (default $0$). If the `<extend>` field does not exist, then `<amount>` does not exist either; if `<extend>` is `LSL`, then `<amount>` must be present; if `<extend>` exists but is not `LSL`, then `<amount>` is an optional choice.

##### add(immediate)

`add(immediate)` adds a register value and an optionally shifted immediate value and writes the result to the destination register. This instruction can be used as an alias for `MOV(to/from SP)`.

```asm
ADD <Wd|WSP>, <Wn|WSP>, #<imm>{, <shift>} ; 32-bits
ADD <Xd|SP>, <Xn|SP>, #<imm>{, <shift>}   ; 64-bits
```

![add immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041138935.png)

When $sh = 0$ and $imm12 = 0$, and $R_n = SP$ and $R_d = SP$, it can be used as an alias for `MOV`:

![add mov](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041142177.png)

Field names that are the same as before will not be introduced in detail here. `imm12` is similar to `imm3`, except that `imm12` here is immediate data used for computation, in the range $0 - 4095$.

For the `<shift>` field, the `LSL #0` operation is performed on the `<imm12>` field by default. If $sh = 1$, the `LSL #12` operation is performed (i.e. sign extension).

```cpp
case sh of
  when '0' imm = ZeroExtend(imm12, datasize);
  when '1' imm = ZeroExtend(imm12:Zeros(12), datasize);
```

##### add(shifted register)

`add(shifted register)` adds a register value and an optionally shifted register value and writes the result to the destination register.

```asm
ADD <Wd>, <Wn>, <Wm>{, <shift> #<amount>} ; 32-bits
ADD <Xd>, <Xn>, <Xm>{, <shift> #<amount>} ; 64-bits
```

![add(shifted register)](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041156195.png)

For the `<shift>` field, it processes the second source register:

| type |    code    |
|:----:|:----------:|
| LSL  | shift = 00 |
| LSR  | shift = 01 |
| ASR  | shift = 10 |

The `<amount>` field is related to the `imm6` field and gives the width of the shift; its range is $0 - 31$, defaulting to $0$.

##### adds

The `adds` instruction also has three cases: `adds(extended register)`, `adds(immediate)`, and `adds(shifted register)`. The only differences from `add` above are the `<S>` flag **and the fact that it performs the addition while updating the condition flags** ($N$, $Z$, $C$, $V$). Everything else is unchanged.

![adds](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041216169.png)

```asm
; adds(extend register)
ADDS <Wd>, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}   ; 32-bits
ADDS <Xd>, <Xn|SP>, <R><m>{, <extend> {#<amount>}}  ; 64-bits

; adds(immediate)
ADDS <Wd>, <Wn|WSP>, #<imm>{, <shift>}
ADDS <Xd>, <Xn|SP>, #<imm>{, <shift>}

; adds(shifted register)
ADDS <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
ADDS <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
```

|  condition  |    meaning     |
|:-----------:|:--------------:|
| N(Negative) | $result \lt 0$ |
|   Z(Zero)   |  $result = 0$  |
|  C(Carry)   |     carry      |
| V(Overflow) |   over flow    | 

There is one more difference:

- `adds(extended register)` can be used as an alias for `CMN(extended register)`
- `adds(immediate)` can be used as an alias for `CMN(immediate)`
- `adds(shifted register)` can be used as an alias for `CMN(shifted register)`

##### add code

First, through the macro definitions mentioned above, we give the fields and bit widths corresponding to the `add` instruction set.

```cpp
#define ADD_SUB_FIELD_LIST(V)           \
    V(ADD_SUB, S, 29, 29)               \
    V(ADD_SUB, Sh, 22, 22)              \
    V(ADD_SUB, Imm12, 21, 10)           \
    V(ADD_SUB, Shift, 23, 22)           \
    V(ADD_SUB, ShiftAmount, 15, 10)     \
    V(ADD_SUB, ExtendOption, 15, 13)    \
    V(ADD_SUB, ExtendShift, 12, 10)
```

Because the `add` and `sub` instruction sets are nearly identical, we place the fields and processing logic of both instruction sets together in `AddSubImm` and `AddSubReg`.

```cpp
void AssemblerAarch64::AddSubImm(AddSubOpCode op, const Register &rd, const Register &rn, bool setFlags, uint64_t imm)
{
    ASSERT(IsAddSubImm(imm));
    uint32_t shift = 0;
    const uint64_t IMM12_MASK = (1 << ADD_SUB_Imm12_WIDTH) - 1;
    uint64_t imm12 = imm & (~IMM12_MASK);
    if (imm12 != 0) {
        shift = 1;
    } else {
        imm12 = imm;
    }
    uint32_t flags_field = ((setFlags ? 1 : 0) << ADD_SUB_S_LOWBITS) & ADD_SUB_S_MASK;
    uint32_t imm_field = (imm12 << ADD_SUB_Imm12_LOWBITS) & ADD_SUB_Imm12_MASK;
    uint32_t shift_field = (shift << ADD_SUB_Sh_LOWBITS) & ADD_SUB_Sh_MASK;
    uint32_t code = Sf(!rd.IsW()) | op | flags_field | shift_field | imm_field | Rd(rd.GetId()) | Rn(rn.GetId());
    EmitU32(code);
}
```

For the handling of `add(immediate)`, we need to extract whether extension is needed and the immediate value, and then move them to the corresponding bits. `setFlags` is used to distinguish between `add` and `adds`.

```cpp
void AssemblerAarch64::AddSubReg(AddSubOpCode op, const Register &rd, const Register &rn,
                                 bool setFlags, const Operand &operand)
{
    uint32_t flags_field = ((setFlags ? 1 : 0) << ADD_SUB_S_LOWBITS) & ADD_SUB_S_MASK;
    uint32_t code = 0;
    if (operand.IsShifted()) {
        uint32_t shift_field = ((operand.GetShiftOption()) << ADD_SUB_Shift_LOWBITS) & ADD_SUB_Shift_MASK;
        uint32_t shift_amount = ((operand.GetShiftAmount()) << ADD_SUB_ShiftAmount_LOWBITS) & ADD_SUB_ShiftAmount_MASK;
        ASSERT((op == ADD_Shift) | (op == SUB_Shift));
        code = Sf(!rd.IsW()) | op | flags_field | shift_field | Rm(operand.Reg().GetId()) |
                  shift_amount | Rn(rn.GetId()) | Rd(rd.GetId());
    } else {
        ASSERT((op == ADD_Extend) | (op == SUB_Extend));
        uint32_t extend_field =
            (operand.GetExtendOption() << ADD_SUB_ExtendOption_LOWBITS) & ADD_SUB_ExtendOption_MASK;
        uint32_t extend_shift = (operand.GetShiftAmount() << ADD_SUB_ExtendShift_LOWBITS) & ADD_SUB_ExtendShift_MASK;
        code = Sf(!rd.IsW()) | op | flags_field | Rm(operand.Reg().GetId()) | extend_field |
                  extend_shift | Rn(rn.GetId()) | Rd(rd.GetId());
    }
    EmitU32(code);
}
```

This handles both `add(extend register)` and `add(shifted register)` at the same time. As you can see, it actually just processes the corresponding field data into the corresponding positions of the real machine code fields.

#### CMP

##### cmp

In `aarch64`, `CMP` has three types, all of which can be equivalent to `SUBS`.

![cmp](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041505225.png)

```asm
; cmp(extend register)
CMP <Wn|WSP>, <Wm>{, <extend> {#<amount>}}  ; 32-bits
  equals SUBS WZR, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}
CMP <Xn|SP>, <R><m>{, <extend> {#<amount>}} ; 64-bits
  equals SUBS XZR, <Xn|SP>, <R><m>{, <extend> {#<amount>}}
  
; cmp(immediate)
CMP <Wn|WSP>, #<imm>{, <shift>} ; 32-bits
  equals SUBS WZR, <Wn|WSP>, #<imm> {, <shift>}
CMP <Xn|SP>, #<imm>{, <shift>}  ; 64-bits
  equals SUBS XZR, <Xn|SP>, #<imm> {, <shift>}
  
; cmp(shifted register)
CMP <Wn>, <Wm>{, <shift> #<amount>} ; 32-bits
  equals SUBS WZR, <Wn>, <Wm> {, <shift> #<amount>}
CMP <Xn>, <Xm>{, <shift> #<amount>} ; 64-bits
  equals SUBS XZR, <Xn>, <Xm> {, <shift> #<amount>}
```

##### CBZ

`CBZ` **compares the value in a register with zero, and if the comparison result is equal, conditionally branches to a label at an offset relative to the current program counter (PC). This instruction provides a hint that this is not a subroutine call or return. This instruction does not affect the condition flags**.

![cbz](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041517189.png)

```asm
CBZ <Wt>, <label> ; 32-bits
CBZ <Xt>, <label> ; 64-bits
```

For `CBZ`, the simplest implementation is to jump directly to an immediate address, but for greater convenience we also added a `Label` overload, which computes the offset through the `Label` and then performs the jump:

```cpp

void AssemblerAarch64::Cbz(const Register &rt, Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    Cbz(rt, offsetImm);
}

void AssemblerAarch64::Cbz(const Register &rt, int32_t imm)
{
    uint32_t code = Sf(!rt.IsW()) | BranchOpCode::CBZ | BranchImm19(imm) | rt.GetId();
    EmitU32(code);
}
```

##### CBNZ

`CBNZ` **compares the value in a register with zero, and if the comparison result is not equal, conditionally branches to a label at an offset relative to the current program counter (PC). This instruction provides a hint that this is not a subroutine call or return. This instruction does not affect the condition flags**.

![cbnz](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041527765.png)

```asm
CBNZ <Wt>, <label> ; 32-bits
CBNZ <Xt>, <label> ; 64-bits
```

The code implementation of `CBNZ` is almost the same as that of `CBZ`:

```cpp
void AssemblerAarch64::Cbnz(const Register &rt, Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    Cbnz(rt, offsetImm);
}

void AssemblerAarch64::Cbnz(const Register &rt, int32_t imm)
{
    uint32_t code = Sf(!rt.IsW()) | BranchOpCode::CBNZ | BranchImm19(imm) | rt.GetId();
    EmitU32(code);
}
```

#### Branch

##### B

`B` **causes an unconditional branch to a label at an offset relative to the program counter (PC), and provides a hint that this is not a subroutine call or return**.

![b](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041544668.png)

For better support, we also made an overload for `Label`, just like with `CMP`:

```cpp
void AssemblerAarch64::B(Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    B(offsetImm);
}

void AssemblerAarch64::B(int32_t imm)
{
    uint32_t code = BranchOpCode::Branch | ((imm << BRANCH_Imm26_LOWBITS) & BRANCH_Imm26_MASK);
    EmitU32(code);
}
```

##### B.cond

`B.cond` **conditionally branches to a label at an offset relative to the program counter (PC), and provides a hint that this is not a subroutine call or return**.

![B.cond](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041552227.png)

For `<cond>`, the standard `conditions` can be used; you can refer to the `Condition` implemented above or the corresponding reference manual.

The offset of `<label>` relative to the address of this instruction is within $±1MB$.

```cpp
void AssemblerAarch64::B(Condition cond, Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    B(cond, offsetImm);
}

void AssemblerAarch64::B(Condition cond, int32_t imm)
{
    uint32_t code = BranchOpCode::BranchCond | BranchImm19(imm) | cond;
    EmitU32(code);
}
```

##### Br

`Br` **unconditionally branches to the address in a register, and provides a hint that this is not a subroutine return**.

![Br](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041605898.png)

```cpp
void AssemblerAarch64::Br(const Register &rn)
{
    uint32_t code = BranchOpCode::BR | Rn(rn.GetId());
    EmitU32(code);
}
```

##### Blr

`Blr` **calls the subroutine at the address in a register, and sets register `X30` to** $PC+4$.

![blr](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041613453.png)

```cpp
void AssemblerAarch64::Blr(const Register &rn)
{
    ASSERT(!rn.IsW());
    uint32_t code = CallOpCode::BLR | Rn(rn.GetId());
    EmitU32(code);
}
```

##### Bl

`Bl` **branches to a location at an offset relative to the program counter (PC), and sets register `X30` to $PC+4$. It provides a hint that this is a subroutine call**.

![Bl](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407041618598.png)

```cpp
void AssemblerAarch64::Bl(Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    Bl(offsetImm);
}

void AssemblerAarch64::Bl(int32_t imm)
{
    uint32_t code = CallOpCode::BL | ((imm << BRANCH_Imm26_LOWBITS) & BRANCH_Imm26_MASK);
    EmitU32(code);
}
```

#### TB

##### TBNZ

`TBNZ` **compares a bit in a general-purpose register with zero, and when the comparison result is not equal to zero, conditionally branches to a label at a PC-relative offset. This instruction provides a hint that this is not a subroutine call or return. This instruction does not affect the condition flags**.

![TBNZ](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407051013408.png)

```asm
TBNZ <R><t>, #<imm>, <label>
```

Here `<imm>` refers to which bit of data; it is composed of $b5:b40$ together.

And `<label>` is related to `imm14`; its range is $+/-32KB$

In the actual processing, we still provide two implementation versions, `imm` and `Label`:

```cpp
void AssemblerAarch64::Tbnz(const Register &rt, int32_t bitPos, Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    Tbnz(rt, bitPos, offsetImm);
}

void AssemblerAarch64::Tbnz(const Register &rt, int32_t bitPos, int32_t imm)
{
    uint32_t b5 = (bitPos << (BRANCH_B5_LOWBITS - 5)) & BRANCH_B5_MASK;
    uint32_t b40 = (bitPos << BRANCH_B40_LOWBITS) & BRANCH_B40_MASK;
    uint32_t imm14 = (imm <<BRANCH_Imm14_LOWBITS) & BRANCH_Imm14_MASK;
    uint32_t code = b5 | BranchOpCode::TBNZ | b40 | imm14 | rt.GetId();
    EmitU32(code);
}
```

##### TBZ

`TBZ` **compares the value of the tested bit with zero, and when the comparison result is equal to zero, conditionally branches to a label at a PC-relative offset. This instruction provides a hint that this is not a subroutine call or return. This instruction does not affect the condition flags**.

![TBZ](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407051019765.png)

```asm
TBZ <R><t>, #<imm>, <label>
```

The actual processing is the same as for `TBNZ`:

```cpp
void AssemblerAarch64::Tbz(const Register &rt, int32_t bitPos, Label *label)
{
    int32_t offsetImm = LinkAndGetInstOffsetToLabel(label);
    // 2 : 2 means 4 bytes aligned.
    offsetImm >>= 2;
    Tbz(rt, bitPos, offsetImm);
}

void AssemblerAarch64::Tbz(const Register &rt, int32_t bitPos, int32_t imm)
{
    uint32_t b5 = (bitPos << (BRANCH_B5_LOWBITS - 5)) & BRANCH_B5_MASK;
    uint32_t b40 = (bitPos << BRANCH_B40_LOWBITS) & BRANCH_B40_MASK;
    uint32_t imm14 = (imm << BRANCH_Imm14_LOWBITS) & BRANCH_Imm14_MASK;
    uint32_t code = b5 | BranchOpCode::TBZ | b40 | imm14 | rt.GetId();
    EmitU32(code);
}
```

#### TST

##### TST(immediate)

The `TST(immediate)` **instruction performs a bitwise AND operation on two operands but does not save the result. Instead, it sets or clears the relevant flags in the condition flag register based on the result of the operation**.

![TST(immediate)](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407051033270.png)

It is worth noting that one alias of `TST(immediate)` is `ADDS(immediate)`.

```asm
; sf = 0 && N = 0
TST <Wn>, #<imm>
  equals ANDS WZR, <Wn>, #<imm>
  
; sf = 1
TST <Xn>, #<imm>
  equals ANDS XZR, <Xn>, #<imm>
```

Note about `<imm>` here: in $32-bits$, it is composed of $imms:immr$; in $64-bits$, it is composed of $N:imms:immr$.

```cpp
void AssemblerAarch64::Tst(const Register &rn, const LogicalImmediate &imm)
{
    Ands(Register(Zero, rn.GetType()), rn, imm);
}
```

##### TST(shifted register)

`TST(shifted register)` **performs a bitwise AND operation on a register value and an optionally shifted register value. It updates the condition flags based on the result and discards the result**.

![TST(shifted register)](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407051040715.png)

It is worth noting that one alias of `TST(shifted register)` is `ADDS(shifted register)`.

```asm
TST <Wn>, <Wm>{, <shift> #<amount>} ; 32-bits
  equals ANDS WZR, <Wn>, <Wm>{, <shift> #<amount>}

TST <Xn>, <Xm>{, <shift> #<amount>} ; 64-bits
  equals ANDS XZR, <Xn>, <Xm>{, <shift> #<amount>}
```

The available options for `<shift>` here are:

![shift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407051048196.png)

#### Logic

For the assembly implementation of the logic part of the `aarch64` architecture in `ArkTS`, it is mainly divided into two categories: `Orr` and `And`. More importantly, the internal implementations of `Orr` and `And` are actually very similar, so we use a function like `BitWiseOP` to unify their internal logic.

The specific difference between `Orr` and `And` mainly lies in the `opcode`.

```cpp
enum BitwiseOpCode {
    AND_Imm      = 0x12000000,
    AND_Shift    = 0x0a000000,
    ANDS_Imm     = 0x72000000,
    ANDS_Shift   = 0x6a000000,
    ORR_Imm      = 0x32000000,
    ORR_Shift    = 0x2a000000,
};
```

For instructions under `immediate`, we only need to pass in the corresponding `opcode` directly, without any extra processing:

```cpp
void AssemblerAarch64::BitWiseOpImm(BitwiseOpCode op, const Register &rd, const Register &rn, uint64_t imm)
{
    uint32_t code = Sf(!rd.IsW()) | op | imm | Rn(rn.GetId()) | Rd(rd.GetId());
    EmitU32(code);
}
```

For `shifted` instructions, we need to use the previously implemented `Operand` to handle the `shift` operation specifically:

```cpp

void AssemblerAarch64::BitWiseOpShift(BitwiseOpCode op, const Register &rd, const Register &rn, const Operand &operand)
{
    uint32_t shift_field = (operand.GetShiftOption() << BITWISE_OP_Shift_LOWBITS) & BITWISE_OP_Shift_MASK;
    uint32_t shift_amount = (operand.GetShiftAmount() << BITWISE_OP_ShiftAmount_LOWBITS) & BITWISE_OP_ShiftAmount_MASK;
    uint32_t code = Sf(!rd.IsW()) | op | shift_field | Rm(operand.Reg().GetId()) |
                       shift_amount | Rn(rn.GetId()) | Rd(rd.GetId());
    EmitU32(code);
}
```

Things like `BITWISE_OP_Shift_LOWBITS` here are implemented through the `BITWISE_OP_FIELD_LIST` macro:

```cpp
#define BITWISE_OP_FIELD_LIST(V)            \
    V(BITWISE_OP, N, 22, 22)                \
    V(BITWISE_OP, Immr, 21, 16)             \
    V(BITWISE_OP, Shift, 23, 22)            \
    V(BITWISE_OP, Imms, 15, 10)             \
    V(BITWISE_OP, ShiftAmount, 15, 10)
```

##### ORR(immediate)

`Orr immediate` **performs a bitwise OR (inclusive OR) operation on a register value and an immediate register value, and writes the result to the destination register. This instruction can be used as an alias for** `MOV(bitmask immediate)`.

![Orr immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161552892.png)

When $Rn = 11111$ and `!MoveWidePreferred(sf, N, imms, immr)`, it can be used as an alias for `Mov(bitmask immediate)`.

```asm
ORR <Wd|WSP>, <Wn>, #<imm>  ; 32-bits
ORR <Xd|SP>, <Xn>, #<imm>   ; 64-bits
```

For `<imm>`, in $32bits$ it is composed of `imms:immr`; in $64bits$ it is composed of `N:imms:immr`.

##### ORR(shifted register)

`Orr(shifted register)` **performs a bitwise OR (inclusive OR) operation on a register value and an optionally shifted register value, and writes the result to the destination register. This instruction can be used as an alias for** `MOV(register)`.

![orr shifted register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161557139.png)

When $shite = 00$ and $imm6 = 000000$ and $Rn = 11111$, it can be used as an alias for `Mov(register)`.

```asm
ORR <Wd>, <Wn>, <Wm>{, <shift> #<amount>} ; 32-bits
ORR <Xd>, <Xn>, <Xm>{, <shift> #<amount>} ; 64-bits
```

##### AND(immediate)

`And(immediate)` **performs a bitwise AND operation on a register value and an immediate value, and writes the result to the destination register**.

![and immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161507612.png)

```asm
AND <Wd|WSP>, <Wn>, #<imm>  ; 32-bits
AND <Xd|SP>, <Xn>, #<imm>   ; 64-bits
```

For `<imm>`, in $32bits$ it is composed of `imms:immr`; in $64bits$ it is composed of `N:imms:immr`.

##### AND(shifted register)

`And(shifted register)` **performs a bitwise AND operation on a register value and an optionally shifted register value, and writes the result to the destination register**.

![and shifted](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161513255.png)

```asm
AND <Wd>, <Wn>, <Wm>{, <shift> #<amount>} ; 32-bits
AND <Xd>, <Xn>, <Xm>{, <shift> #<amount>} ; 64-bits
```

##### ANDS(immediate)

`Ands immediate` **performs a bitwise AND operation on a register value and an immediate value, and writes the result to the destination register. It updates the condition flags based on the result. This instruction can be used as an alias for** `TST(immediate)`.

![ands immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161523841.png)

When $Rd = 11111$, it can be used as an alias for `TST(immediate)`.

```asm
ANDS <Wd>, <Wn>, #<imm> ; 32-bits
ANDS <Xd>, <Xn>, #<imm> ; 64-bits
```

For `<imm>`, in $32bits$ it is composed of `imms:immr`; in $64bits$ it is composed of `N:imms:immr`.

##### ANDS(shifted register)

`Ands shifted register` **performs a bitwise AND operation on a register value and an optionally shifted register value, and writes the result to the destination register. It updates the condition flags based on the result. This instruction can be used as an alias for** `TST(shifted register)`.

![ands shifted](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161536291.png)

When $Rd = 11111$, it can be used as an alias for `TST(shifted register)`.

```asm
ANDS <Wd>, <Wn>, <Wm>{, <shift> #<amount>}  ; 32-bits
ANDS <Xd>, <Xn>, <Xm>{, <shift> #<amount>}  ; 64-bits
```

#### Shift

##### LSR(immediate)

`LSR(immediate)` **shifts a register value right by a fixed number of bits, shifting in zeros, and writes the result to the destination register**.

This instruction is an alias of the `UBFM` instruction. This means:

- In this description, the encoding is named to match the encoding of `UBFM`.
- The description of `UBFM` provides the operational pseudocode, any `CONSTRAINED UNPREDICTABLE` behavior, and the operational information for this instruction.

![lsr immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161614990.png)

```asm
LSR <Wd>, <Wn>, #<shift> ; 32-bits
  equals UBFM <Wd>, <Wn>, #<shift>, #31
  when sf == 0 && N == 0 && imms == 011111 
  
LSR <Xd>, <Xn>, #<shift> ; 64-bits
  equals UBFM <Xd>, <Xn>, #<shift>, #63
  when sf == 1 && N == 1 && imms == 111111 
```

##### LSR(register)

`LSR(register)` **shifts a register value right by a variable number of bits, shifting in zeros, and writes the result to the destination register. The remainder of dividing the second source register by the data size determines the number of bits by which the first source register is shifted right**.

This instruction is an alias of the `LSRV` instruction. This means:

- In this description, the encoding is named to match the encoding of `LSRV`.
- The description of `LSRV` provides the operational pseudocode, any `CONSTRAINED UNPREDICTABLE` behavior, and the operational information for this instruction.

![lsr register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161618114.png)

```asm
LSR <Wd>, <Wn>, <Wm>  ; 32-bits
  equals LSRV <Wd>, <Wn>, <Wm>
  when sf == 0 
  
LSR <Xd>, <Xn>, <Xm>  ; 64-bits
  equals LSRV <Xd>, <Xn>, <Xm>
  when sf == 1 
```

##### LSL(register)

`LSL(register)` **shifts a register value left by a variable number of bits, shifting in zeros, and writes the result to the destination register. The remainder of dividing the second source register by the data size determines the number of bits by which the first source register is shifted left**.

This instruction is an alias of the `LSLV` instruction. This means:

- In this description, the encoding is named to match the encoding of `LSLV`.
- The description of `LSLV` provides the operational pseudocode, any `CONSTRAINED UNPREDICTABLE` behavior, and the operational information for this instruction

![lsl register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161622992.png)

```asm
LSL <Wd>, <Wn>, <Wm>  ; 32-bits
  equals LSRV <Wd>, <Wn>, <Wm>
  when sf == 0 
  
LSL <Xd>, <Xn>, <Xm>  ; 64-bits
  equals LSRV <Xd>, <Xn>, <Xm>
  when sf == 1 
```

##### UBFM

`Unsigned Bitfield Move` **is usually accessed through its aliases, which are always preferred when disassembling**.

- If $imms \ge immr$, the bit field of length ($imms - immr + 1$) bits starting at bit `immr` in the source register is copied to the least significant bits of the destination register.
- If $imms \lt immr$, the bit field of length ($imms + 1$) bits in the least significant bits of the source register is copied to bit position ($regsize - immr$) of the destination register, where `regsize` is the size of the destination register, which can be $32$ or $64$ bits.
- In both cases, the destination bits below and above the bit field are set to zero.

![UBFM](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161610214.png)

The use cases of `UBFM` are typically:

- Bit field operations: extract a specific bit field from one register and copy it into another register for subsequent processing or use.
- Data parsing: when processing binary data, the UBFM instruction can be used to extract a specific bit field and convert it into a meaningful value or state.

This instruction can be used as an alias for `LSL(immediate)`, `LSR(immediate)`, `UBFIZ`, `UBFX`, `UXTB`, and `UXTH`.

![alias ubfm](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161612084.png)


```asm
UBFM <Wd>, <Wn>, #<immr>, #<imms> ; 32-bits
UBFM <Xd>, <Xn>, #<immr>, #<imms> ; 64-bits
```

#### Store and Load

##### LDP

The `LDP` **instruction computes an address from a base register value and an immediate offset, loads two 32-bit words or two 64-bit doublewords from memory, and writes them into two registers**.

In `AddrMode` we mentioned that there are usually three memory modes: `Post`, `Pre`, and `Signed offset`

![memory mode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161653917.png)

```asm
; Post-index
LDP <Wt1>, <Wt2>, [<Xn|SP>], #<imm> ; 32-bits, when opc == 00 
LDP <Xt1>, <Xt2>, [<Xn|SP>], #<imm> ; 64-bits, when opc == 10 

; Pre-index
LDP <Wt1>, <Wt2>, [<Xn|SP>, #<imm>]! ; 32-bits, when opc == 00 
LDP <Xt1>, <Xt2>, [<Xn|SP>, #<imm>]! ; 64-bits, when opc == 10 

; Signed offset
LDP <Wt1>, <Wt2>, [<Xn|SP>{, #<imm>}] ; 32-bits, when opc == 00 
LDP <Xt1>, <Xt2>, [<Xn|SP>{, #<imm>}] ; 64-bits, when opc == 10
```

The explanations for `<imm>` are as follows:

- For the 32-bit `Post-index` and 32-bit `Pre-index` variants: the signed immediate byte offset is in the range $-256 ~ 252$, is a multiple of `4`, and is encoded in the `imm7` field as $imm/4$.
- For the 32-bit `Signed offset` variant: the optional signed immediate byte offset is in the range $-256 ~ 252$, is a multiple of `4`, defaults to `0`, and is encoded in the `imm7` field as $imm/4$.
- For the 64-bit `Post-index` and 64-bit `Pre-index` variants: the signed immediate byte offset is in the range $-512 ~ 504$, is a multiple of `8`, and is encoded in the `imm7` field as $imm/8$.
- For the 64-bit `Signed offset` variant: the optional signed immediate byte offset is in the range $-512 ~ 504$, is a multiple of `8`, defaults to `0`, and is encoded in the `imm7` field as $imm/8$.

In the actual code processing, the above is also well reflected:

```cpp
enum LoadStorePairOpCode {
    LDP_Post     = 0x28c00000,
    LDP_Pre      = 0x29c00000,
    LDP_Offset   = 0x29400000,
};

if (sf) {
    imm >>= 3;  // 3: 64 RegSise, imm/8 to remove trailing zeros
} else {
    imm >>= 2;  // 2: 32 RegSise, imm/4 to remove trailing zeros
}
```

##### Vector LDP

The `LDP(SIMD&FP)` **instruction loads a pair of `SIMD&FP` registers from memory. The address used for the load is computed from a base register value and an optional immediate offset**.

Depending on the settings in the `CPACR_EL1`, `CPTR_EL2`, and `CPTR_EL3` registers, as well as the current Security state and Exception level, an attempt to execute this instruction might be trapped.

![ldp simd](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161713110.png)

```asm
; Post-index
LDP <St1>, <St2>, [<Xn|SP>], #<imm>   ; 32-bits, when opc == 00(S)
LDP <Dt1>, <Dt2>, [<Xn|SP>], #<imm>   ; 64-bits, when opc == 01(D)
LDP <Qt1>, <Qt2>, [<Xn|SP>], #<imm>   ; 128-bits, when opc == 10(Q)

; Pre-index
LDP <St1>, <St2>, [<Xn|SP>, #<imm>]!  ; 32-bits, when opc == 00(S)
LDP <Dt1>, <Dt2>, [<Xn|SP>, #<imm>]!  ; 64-bits, when opc == 01(D)
LDP <Qt1>, <Qt2>, [<Xn|SP>, #<imm>]!  ; 128-bits, when opc == 10(Q)

; Signed offset
LDP <St1>, <St2>, [<Xn|SP>{, #<imm>}] ; 32-bits, when opc == 00(S)
LDP <Dt1>, <Dt2>, [<Xn|SP>{, #<imm>}] ; 64-bits, when opc == 01(D)
LDP <Qt1>, <Qt2>, [<Xn|SP>{, #<imm>}] ; 128-bits, when opc == 10(Q)
```

The explanations for `<imm>` are as follows:

- For the 32-bit `Post-index` and 32-bit `Pre-index` variants: the signed immediate byte offset is in the range $-256 ~ 252$, is a multiple of `4`, and is encoded in the `imm7` field as $imm / 4$.
- For the 32-bit `Signed offset` variant: the optional signed immediate byte offset is in the range $-256 ~ 252$, is a multiple of `4`, defaults to `0`, and is encoded in the `imm7` field as $imm / 4$.
- For the 64-bit `Post-index` and 64-bit `Pre-index` variants: the signed immediate byte offset is in the range $-512 ~ 504$, is a multiple of `8`, and is encoded in the `imm7` field as $imm / 8$.
- For the 64-bit `Signed offset` variant: the optional signed immediate byte offset is in the range $-512 ~ 504$, is a multiple of `8`, defaults to `0`, and is encoded in the `imm7` field as $imm / 8$.
- For the 128-bit `Post-index` and 128-bit `Pre-index` variants: the signed immediate byte offset is in the range $-1024 ~ 1008$, is a multiple of `16`, and is encoded in the `imm7` field as $imm / 16$.
- For the 128-bit `Signed offset` variant: the optional signed immediate byte offset is in the range $-1024 ~ 1008$, is a multiple of `16`, defaults to `0`, and is encoded in the `imm7` field as $imm / 16$.

This is also reflected in its concrete implementation:

```cpp
switch (vt.GetScale()) {
    case S:
        // 2 : 2 means remove trailing zeros
        imm >>= 2;
        break;
    case D:
        // 3 : 3 means remove trailing zeros
        imm >>= 3;
        break;
    case Q:
        // 4 : 4 means remove trailing zeros
        imm >>= 4;
        break;
    default:
        LOG_ECMA(FATAL) << "this branch is unreachable";
        UNREACHABLE();
}
```

##### LDR(immediate)

The `LDR(immediate)` **instruction loads a word or doubleword from memory and writes it into a register. The address used for the load is computed from a base register and an immediate offset. The unsigned offset variant scales the immediate offset value by the size of the accessed value, and then adds it to the base register value**.

![ldr immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161730888.png)

```asm
; Post-index
LDR <Wt>, [<Xn|SP>], #<simm>    ; 32-bits, when size == 10 
LDR <Xt>, [<Xn|SP>], #<simm>    ; 64-bits, when size == 11

; Pre-index
LDR <Wt>, [<Xn|SP>, #<simm>]!   ; 32-bits, when size == 10
LDR <Xt>, [<Xn|SP>, #<simm>]!   ; 64-bits, when size == 11

; Signed offset
LDR <Wt>, [<Xn|SP>{, #<pimm>}]  ; 32-bits, when size == 10
LDR <Xt>, [<Xn|SP>{, #<pimm>}]  ; 64-bits, when size == 11 
```

In practice, we handle both cases together in the `Ldr` function; the processing logic of `ldr(immediate)` is given here:

```cpp
if (operand.IsImmediateOffset()) {
    uint64_t imm = GetImmOfLdr(operand, scale, regX);
    bool isSigned = operand.GetAddrMode() != AddrMode::OFFSET;
    // 30: 30bit indicate the size of LDR Reg, and Ldrb and Ldrh do not need it
    uint32_t instructionCode = ((regX && (scale == Scale::Q)) << 30) | op | LoadAndStoreImm(imm, isSigned) |
                                Rn(operand.GetRegBase().GetId()) | Rt(rt.GetId());
    EmitU32(instructionCode);
}
```

##### LDR(register)

The `LDR(register)` **instruction computes an address from a base register value and an offset register value, loads a word from memory, and writes it into a register. The offset register value can optionally be shifted and extended**.

![ldr register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161747916.png)

```asm
LDR <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}] ; 32-bits, when size == 10 
LDR <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}] ; 64-bits, when size == 11
```

`<extend>` is the index extend/shift specifier (`index extend/shift specifier`), defaulting to `LSL (left shift)`. When `<amount>` is omitted, `<extend>` must be omitted for `LSL`. It is decoded as the `option` field. It can have the following values:

```asm
UXTW    when option = 010
LSL     when option = 011
SXTW    when option = 110
SXTX    when option = 111
```

`<amount>` is the index shift amount, optional when `<extend>` is not `LSL`. Where it is permitted to be optional, its default value is `0`, and it is decoded as the `S` field:

```asm
; 32-bits
#0 when S = 0
#2 when S = 1

; 64-bits
#0 when S = 0
#3 when S = 1
```

##### LDRB(immediate)

`LDRB(immediate)` **loads a byte from memory, zero-extends it, and writes the result to a register. The address used for the load is computed from a base register and an immediate offset**.

![ldrb immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161800512.png)

```asm
; Post-index
LDRB <Wt>, [<Xn|SP>], #<simm>

; Pre-index
LDRB <Wt>, [<Xn|SP>, #<simm>]!

; Signed offset
LDRB <Wt>, [<Xn|SP>{, #<pimm>}]
```

The concrete implementation of `LDRB` is done directly through `LDR`:

```cpp
void AssemblerAarch64::Ldrb(const Register &rt, const MemoryOperand &operand)
{
    ASSERT(rt.IsW());
    Ldr(rt, operand, Scale::B);
}
```

##### LDRB(register)

`LDRB(register)` **computes an address from a base register value and an offset register value, loads a byte from memory, zero-extends it, and writes it into a register**.

![ldrb regsiter](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161802805.png)

```asm
; Extended register 
LDRB <Wt>, [<Xn|SP>, (<Wm>|<Xm>), <extend> {<amount>}]  ; when option != 011 .

; Shifted register
LDRB <Wt>, [<Xn|SP>, <Xm>{, LSL <amount>}]  ; when option == 011 
```

##### LDRH(immediate)

`LDRH(immediate)` **loads a halfword from memory, zero-extends it, and writes the result to a register. The address used for the load is computed from a base register and an immediate offset**.

![LDRH(immediate)](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161805014.png)

```asm
; Post-index
LDRH <Wt>, [<Xn|SP>], #<simm>

; Pre-index
LDRH <Wt>, [<Xn|SP>, #<simm>]!

; Unsigned offset
LDRH <Wt>, [<Xn|SP>{, #<pimm>}]
```

Its internal implementation is composed of `LDR`:

```cpp
void AssemblerAarch64::Ldrh(const Register &rt, const MemoryOperand &operand)
{
    ASSERT(rt.IsW());
    Ldr(rt, operand, Scale::H);
}
```

##### LDRH(register)

`LDRH(register)` **computes an address from a base register value and an offset register value, loads a halfword from memory, zero-extends it, and writes it into a register**.

![LDRH register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161807499.png)

```asm
LDRH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
```

##### LDUR

`LDUR` **computes an address from a base register and an immediate offset, loads a 32-bit word or 64-bit doubleword from memory, zero-extends it, and writes it into a register**.

![ldur](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161809487.png)

```asm
LDUR <Wt>, [<Xn|SP>{, #<simm>}]   ; 32-bits, when size == 10
LDUR <Xt>, [<Xn|SP>{, #<simm>}]   ; 64-bits, when size == 11
```

Its concrete implementation is:

```cpp
void AssemblerAarch64::Ldur(const Register &rt, const MemoryOperand &operand)
{
    bool regX = !rt.IsW();
    uint32_t op = LDUR_Offset;
    ASSERT(operand.IsImmediateOffset());
    uint64_t imm = static_cast<uint64_t>(operand.GetImmediate().Value());
    // 30: 30bit indicate the size of LDUR Reg
    uint32_t instructionCode = (regX << 30) | op | LoadAndStoreImm(imm, true) |
                               Rn(operand.GetRegBase().GetId()) | Rt(rt.GetId());
    EmitU32(instructionCode);
}
```

##### STP

`STP` **computes an address from a base register value and an immediate offset, and stores two 32-bit words or two 64-bit doublewords from two registers to the computed address**.

![stp](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161818457.png)

```asm
; Post-index
STP <Wt1>, <Wt2>, [<Xn|SP>], #<imm>   ; 32-bits, when opc == 00 
STP <Xt1>, <Xt2>, [<Xn|SP>], #<imm>   ; 64-bits, when opc == 01

; Pre-index
STP <Wt1>, <Wt2>, [<Xn|SP>, #<imm>]!   ; 32-bits, when opc == 00 
STP <Xt1>, <Xt2>, [<Xn|SP>, #<imm>]!   ; 64-bits, when opc == 01

; Signed offset
STP <Wt1>, <Wt2>, [<Xn|SP>{, #<imm>}]   ; 32-bits, when opc == 00 
STP <Xt1>, <Xt2>, [<Xn|SP>{, #<imm>}]   ; 64-bits, when opc == 01
```

For the actual implementation of `STP`, the main code snippets are:

```cpp
case OFFSET:
    op = LoadStorePairOpCode::STP_Offset;
    break;
case PREINDEX:
    op = LoadStorePairOpCode::STP_Pre;
    break;
case POSTINDEX:
    op = LoadStorePairOpCode::STP_Post;
    break;
    
if (sf) {
    imm >>= 3;  // 3: 64 RegSise, imm/8 to remove trailing zeros
} else {
    imm >>= 2;  // 2: 32 RegSise, imm/4 to remove trailing zeros
}
```

##### Vector STP

`STP(SIMD&FP)` **stores a pair of `SIMD&FP` registers to memory. The address used for the store is computed from a base register value and an immediate offset**.

Depending on the settings in the `CPACR_EL1`, `CPTR_EL2`, and `CPTR_EL3` registers, as well as the current Security state and Exception level, an attempt to execute the instruction might be trapped.

![stp(simd&fp)](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161822544.png)

```asm
; Post-index
STP <St1>, <St2>, [<Xn|SP>], #<imm>   ; 32-bits, when opc == 00(S)
STP <Dt1>, <Dt2>, [<Xn|SP>], #<imm>   ; 64-bits, when opc == 01(D)
STP <Qt1>, <Qt2>, [<Xn|SP>], #<imm>   ; 128-bits, when opc == 10(Q)

; Pre-index
STP <St1>, <St2>, [<Xn|SP>, #<imm>]!   ; 32-bits, when opc == 00(S)
STP <Dt1>, <Dt2>, [<Xn|SP>, #<imm>]!   ; 64-bits, when opc == 01(D)
STP <Qt1>, <Qt2>, [<Xn|SP>, #<imm>]!   ; 128-bits, when opc == 10(Q)

; Signed offset
STP <St1>, <St2>, [<Xn|SP>{, #<imm>}]   ; 32-bits, when opc == 00(S)
STP <Dt1>, <Dt2>, [<Xn|SP>{, #<imm>}]   ; 64-bits, when opc == 01(D)
STP <Qt1>, <Qt2>, [<Xn|SP>{, #<imm>}]   ; 128-bits, when opc == 10(Q)
```

The main part of its code is:

```cpp
case OFFSET:
    op = LoadStorePairOpCode::STP_V_Offset;
    break;
case PREINDEX:
    op = LoadStorePairOpCode::STP_V_Pre;
    break;
case POSTINDEX:
    op = LoadStorePairOpCode::STP_V_Post;
    break;
case S:
    // 2 : 2 means remove trailing zeros
    imm >>= 2;
    break;
case D:
    // 3 : 3 means remove trailing zeros
    imm >>= 3;
    break;
case Q:
    // 4 : 4 means remove trailing zeros
    imm >>= 4;
    break;
```

##### STR

`STR` **stores a word or doubleword from a register to memory. The address used for the store is computed from a base register and an immediate offset**.

![str immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161931064.png)

```asm
; Post-index
STR <Wt>, [<Xn|SP>], #<simm>    ; 32-bits, when size == 10
STR <Xt>, [<Xn|SP>], #<simm>    ; 64-bits, when size == 11

; Pre-index
STR <Wt>, [<Xn|SP>, #<simm>]!   ; 32-bits, when size == 10
STR <Xt>, [<Xn|SP>, #<simm>]!   ; 64-bits, when size == 11

; Unsigned offset
STR <Wt>, [<Xn|SP>{, #<pimm>}]  ; 32-bits, when size == 10
STR <Xt>, [<Xn|SP>{, #<pimm>}]  ; 64-bits, when size == 11
```

In `ArkTS`, `str(immediate)` is mainly implemented; its main internal implementation is:

```cpp
case OFFSET:
    op = LoadStoreOpCode::STR_Offset;
    if (regX) {
        imm >>= 3;   // 3:  64 RegSise, imm/8 to remove trailing zeros
    } else {
        imm >>= 2;  // 2: 32 RegSise, imm/4 to remove trailing zeros
    }
    isSigned = false;
    break;
case PREINDEX:
    op = LoadStoreOpCode::STR_Pre;
    break;
case POSTINDEX:
    op = LoadStoreOpCode::STR_Post;
    break;
```

##### STUR

`STUR` **computes an address from a base register value and an immediate offset, and stores a 32-bit word or 64-bit doubleword from a register to the computed address**.

![stur](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407161935126.png)

```asm
STUR <Wt>, [<Xn|SP>{, #<simm>}]   ; 32-bits, when size == 10
STUR <Xt>, [<Xn|SP>{, #<simm>}]   ; 64-bits, when size == 11
```

Its internal implementation is:

```cpp
void AssemblerAarch64::Ldur(const Register &rt, const MemoryOperand &operand)
{
    bool regX = !rt.IsW();
    uint32_t op = LDUR_Offset;
    ASSERT(operand.IsImmediateOffset());
    uint64_t imm = static_cast<uint64_t>(operand.GetImmediate().Value());
    // 30: 30bit indicate the size of LDUR Reg
    uint32_t instructionCode = (regX << 30) | op | LoadAndStoreImm(imm, true) |
                               Rn(operand.GetRegBase().GetId()) | Rt(rt.GetId());
    EmitU32(instructionCode);
}
```

---  

At this point, the analysis of the `Aarch` assembly of `ArkTS` comes to an end.
