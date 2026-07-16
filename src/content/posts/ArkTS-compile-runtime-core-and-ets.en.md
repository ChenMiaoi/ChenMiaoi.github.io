---
slug: ArkTS-compile-runtime-core-and-ets.en
title: 'ArkTS: compile runtime_core and ets_*'
published: 2024-07-01
tags:
  - arkts
  - ospp
category: arkts
series: arkts
lang: "en"
---
In this section, I will introduce the four major components of `ArkTS` and how to compile and successfully run the `ArkTS` frontend and runtime.

## ArkTS Components

The ArkCompiler is a unified compilation and runtime platform designed to support joint compilation and execution across multiple programming languages and multiple chip platforms. It supports a variety of programming languages, including both dynamically typed and statically typed languages, such as JS, TS, and ArkTS; it is the compilation/runtime foundation that enables OpenHarmony to serve as an operating system spanning phones, PCs, tablets, TVs, in-vehicle systems, smart wearables, and other devices.

Structurally, ArkCompiler is mainly divided into two parts: the compilation toolchain and the runtime.

![编译工具链架构](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407011731363.png)

The ArkCompiler compilation toolchain takes ArkTS/TS/JS source code as input and compiles it into abc (ArkCompiler Bytecode) files. It mainly works through the binary program `es2abc` produced during compilation:

```bash
es2abc hello.js
```

![运行时架构](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407011732850.png)

The ArkCompiler runtime directly executes bytecode files, implementing the semantic logic of the corresponding language specifications.

It mainly consists of four subsystems:

- Core Subsystem 
  - The Core Subsystem mainly consists of language-agnostic base runtime libraries, including the File component that carries bytecode, the Tooling component that supports the Debugger, the Base library component responsible for adapting system calls, and so on. 
- Execution Subsystem 
  - The Execution Subsystem contains the interpreter that executes bytecode, inline caches for fast paths, and a Profiler that captures runtime information. 
- Compiler Subsystem 
  - The Compiler Subsystem contains the Stub compiler, an IR-based compilation optimization framework, and code generators. 
- Runtime subsystem 
  - The Runtime Subsystem contains modules related to ArkTS/TS/JS execution. 
  - Memory management: object allocator and garbage collectors (CMS-GC with concurrent marking and partial memory compression, and Partial-Compressing-GC)
    - Analysis tools: DFX tools, CPU and heap profiling tools 
    - Concurrency management: the abc file manager in the actor concurrency model 
    - Standard library: the standard library defined by the ECMAScript specification, efficient container libraries, and the object model 
    - Others: async work queues, TypeScript type loading, JSNAPI interfaces for interacting with C++, and so on.

In this task, we focus on the `stub` and `assember` in the `Compiler Subsystem`. A concrete working directory structure is given below:

```bash
/arkcompiler
├── ets_runtime       # ArkTS运行时组件
    ├── ecmascript
        ├── compiler  # Assember解析目录
        └── stubs     # stubs
├── runtime_core      # 运行时公共组件
├── ets_frontend      # ArkTS语言的前端工具
└── toolchain         # ArkTS工具链
```

## Compile ETS

The project structure during this compilation process is as follows:

```bash
├── arkcompiler
│         ├── ets_frontend
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ark.py -> arkcompiler/toolchain/build/compile_script/ark.py
├── build
│         ├── build_scripts
│         ├── config
│         ├── core
│         ├── docs
│         ├── ...
│         ├── gn_helpers.py
│         ├── ohos_var.gni
│         ├── prebuilts_download_config.json
│         ├── prebuilts_download.py
│         ├── prebuilts_download.sh
│         └── zip.py
├── developtools
├── download_packages
├── kernel
├── kernel_linux_patches -> kernel/linux/patches/
├── out
│         ├── install
│         ├── lib
│         ├── ... 
│         ├── ohos-riscv64
│         ├── ohos-riscv64-install
│         ├── riscv64.release
│         └── x64.release
├── packages
├── prebuilts
├── README.md
├── third_party
└── toolchain
    ├── lldb-mi
    └── llvm-project
```

### Dependency && Compile

Before officially starting the compilation, we first need to set up the dependency configuration. Currently, the environment I am using is the `Ubuntu 22.04 LTS` distribution,

```bash 
sudo apt-get install git-lfs git bison flex gnupg build-essential zip curl zlib1g-dev gcc-multilib g++-multilib libc6-dev-i386 lib32ncurses-dev x11proto-core-dev libx11-dev libc++1 lib32z1-dev ccache libgl1-mesa-dev libxml2-utils xsltproc unzip m4 libtinfo5 bc npm genext2fs liblz4-tool libssl-dev ruby openjdk-8-jre-headless gdb python3-pip libelf-dev libxcursor-dev libxrandr-dev libxinerama-dev
```

This refers to the dependency configuration from the [Ark Runtime User Guide](https://gitee.com/openharmony/arkcompiler_ets_runtime/blob/master/docs/README_zh.md).

Note that on `Ubuntu18.04` or `Ubuntu20.04`, `python` may still exist (newer systems usually directly support `python3`). Therefore, you need to create a `python` executable via a symbolic link:

```bash
ln -s python3 python
```

After completing this step, we need to download some additional dependencies, which can be automatically configured through the download scripts in the project:

```bash
toolchain/llvm-project/llvm-build/env_prepare.sh
arkcompiler/toolchain/build/prebuilts_download/prebuilts_download.sh
```

Once the downloads are complete, you can use `build.py` to automatically build the `clang` required for compiling `ArkTS`. Here, we need builds for the `x64` and `riscv64` architectures:

```bash
python3 ./toolchain/llvm-project/llvm-build/build.py \
	--no-build-arm \
	--no-build-aarch64 \
	--no-build-mipsel \
	--no-build windows
```

My current configuration is `11th Gen Intel i5-11400H (8) @ 2.688GHz`, using a virtual machine with eight cores and 16 GB of memory, and compiling `clang` usually takes about three and a half hours. After the compilation is complete, you need to copy the resulting `clang` into the `prebuilts` folder:

```bash
mv prebuilts/clang/ohos/linux-x86_64/llvm prebuilts/clang/ohos/linux-x86_64/llvm.origin 
cp -r out/install/linux-x86_64/clang-dev/ prebuilts/clang/ohos/linux-x86_64/llvm
```

To build `ArkTS` adapted for the `riscv64` architecture, we need to build the `LLVM lib` for the `riscv64` architecture separately:

```bash
python3 toolchain/llvm-project/llvm-build/build-ohos-riscv64.py
```

Running `build-ohos-riscv64.py` usually takes about half an hour. Once finished, you need to copy the `LLVM lib` output for the `riscv64` architecture into the `prebuilts` directory:

```bash
mkdir -p prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/{build,llvm}
cp -r out/ohos-riscv64-install/include prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/llvm/
cp -r out/ohos-riscv64/{include,lib} prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/build/
```

With that, the preliminary preparation is complete. Now you can start running the `ark.py` script to compile the `ets_*` toolchain for the corresponding architecture.

Compile the `ArkTS` frontend and runtime for `x86_64`:

```bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py x64.release --verbose
```

Compile the `ArkTS` frontend and runtime for `riscv64`:

```bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py riscv64.release --verbose
```

**Note that, with the unmodified dependencies**, compilation under the `riscv64` **architecture does not take effect on** `ets_frontend`**. How to enable it and fix the `bug` will be introduced later.

Then you can see a directory tree structure in the `out` directory:

```bash
out/
├── install
├── ...
├── ohos-riscv64
├── ohos-riscv64-install
├── riscv64.release
└── x64.release
```

Our target generated files are located at:

```bash
out/x64.release/
├── args.gn
├── arkcompiler
│         ├── ets_frontend
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ...
├── gen
│         ├── arkcompiler
│         ├── isa
│         └── libpandabase
└── toolchain.ninja

out/riscv64.release/
├── args.gn
├── arkcompiler
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ...
├── gen
│         ├── arkcompiler
│         ├── isa
│         └── libpandabase
└── toolchain.ninja
```

Here we can also see that the `arkcompiler` directory under the `riscv64` architecture is missing the generation of `ets_frontend`.

## Dependency Detail && Fix

Above, we found that in the `riscv64` `ArkTS` toolchain we actually need, `ets_frontend` is missing, and the `stub` is not actually compiled either. In this section, I will analyze the `GN` dependencies of `arkcompiler`, and then fix the errors step by step to make `ets_frontend` at least usable.

### Dependency Detail

We perform the automated build through `ark.py`. Now let's trace `ark.py`: its original directory is located at `arkcompiler/toolchain/build/compile_script/`. Then let's dive into `ark.py` for analysis:

```python
def build_for_gn_target(self, out_path: str, gn_args: list, arg_list: list, log_file_name: str):
    # prepare log file
    build_log_path = os.path.join(out_path, log_file_name)
    str_to_build_log = "================================\nbuild_time: {0}\nbuild_target: {1}\n\n".format(
        str_of_time_now(), " ".join(arg_list))
    _write(build_log_path, str_to_build_log, "a")
    # gn command
    print("=== gn gen start ===")
    code = call_with_output(
        "{0} gen {1} --args=\"{2}\"".format(
            self.gn_binary_path, out_path, " ".join(gn_args).replace("\"", "\\\"")),
        build_log_path)
```

`build_for_gn_target` is the main build function, which builds through `gn`, and `gn` is configured via the `.gn` file in the same directory:

```bash
# The location of the build configuration file.
buildconfig = "//arkcompiler/toolchain/build/config/BUILDCONFIG.gn"

# The source root location.
root = "//arkcompiler/toolchain/build/core/gn"
```

For now, we don't need to pay attention to the configuration in `buildconfig`; our main build logic is located in `root`. Also, after enabling `riscv64`, we first need to know this information:

```bash
current_os=ohos,   current_cpu=riscv64
host_os=linux,      host_cpu=x64
target_os=ohos,    target_cpu=riscv64
```

First, `//root` sets up a basic default build logic: when `host_os` is not running on `MacOS`, all four components of `ArkTS` should be built:

```txt
group("default") {
  if (host_os != "mac") {
    deps = [
      ":ets_frontend",
      ":ets_runtime",
      ":runtime_core",
      ":toolchain",
    ]
  }
}
```

#### ets_runtime

Next, let's take a look at the build logic of `ets_runtime`:

```txt
group("ets_runtime") {
  deps = [
    "$js_root:libark_jsruntime",
    "$js_root/ecmascript/js_vm:ark_js_vm",
    "$js_root/ecmascript/quick_fix:quick_fix",
  ]
  if ((target_os == "linux" && target_cpu == "x64") ||
      (target_cpu == "arm64" && target_os == "ohos")) {
    deps += [
      "$js_root/ecmascript/compiler:ark_aot_compiler",
      "$js_root/ecmascript/compiler:ark_stub_compiler",
      "$js_root/ecmascript/pgo_profiler/prof_dump:profdump",
    ]
  }
}
```

As you can see, in the dependencies, we generate two executables, `ark_js_vm` and `quick_fix`. We mainly focus on the generation of `ark_js_vm`. Later we found that build dependencies for `ark_stub_compiler` are only provided for the `x64` architecture's `ets_runtime`, but not for `riscv64`. Therefore, **I guess that in the subsequent implementation, we need to add support for the** `riscv64-ohos` **architecture here**.

But for now, since the implementation of `riscv stub` still has some minor issues, we will ignore it for the moment. Here, `ets_runtime` can compile normally in all cases.

#### ets_frontend

Now, let's take a look at the build logic of `ets_frontend`:

```txt
group("ets_frontend") {
  if ((target_os == "linux" && target_cpu == "x64") || target_os == "mingw") {
    deps = [
      "$ets_frontend_root/es2panda:es2panda",
      "$ets_frontend_root/merge_abc:merge_abc",
    ]
  }
}
```

Here we can see that `ets_frontend` only provides full support for `x64`, so some modifications are needed:

```txt
group("ets_frontend") {
  # FIX: Add the ohos-riscv64 ets_frontend dependency
  if ((target_os == "linux" && target_cpu == "x64") || 
      (target_os == "mingw") || 
      (target_os == "ohos" && target_cpu == "riscv64")) {
    deps = [
      "$ets_frontend_root/es2panda:es2panda",
      "$ets_frontend_root/merge_abc:merge_abc",
    ]
  }
}
```

After the modification, we try to run it:

```bash
ERROR at //arkcompiler/toolchain/build/templates/cxx/cxx.gni:182:7: Script returned non-zero exit code.
      exec_script("$build_root/templates/cxx/external_deps_handler.py",
      ^----------
      
See //arkcompiler/toolchain/build/third_party_gn/protobuf/BUILD.gn:85:1: whence it was called.
ohos_static_library("protobuf_lite_static") {
^--------------------------------------------

See //arkcompiler/ets_frontend/merge_abc/BUILD.gn:148:5: which caused the file to be included.
    "$ark_third_party_root/protobuf:protobuf_lite_static",
    ^----------------------------------------------------
```

An error occurs. After checking the error log, we find that there is a dependency that cannot be handled by `external_deps_handler.py`, and that dependency is `[hilog:libhilog]`.

From the log, we find that the first call stack to appear is `arkcompiler/ets_frontend/merge_abc/BUILD.gn:148:5`, so we can check it:

```txt
# Cause Proto -> hilog:libhilog
deps = [
    ":arkcompiler_generate_proto",
    "$ark_third_party_root/protobuf:protobuf_lite_static",
    "$ark_third_party_root/protobuf:protobuf_static",
]
```

We can find that the problem lies in the `protobuf_lite_static` dependency, so we go into `arkcompiler/toolchain/build/third_party_gn/protobuf/BUILD.gn:85:1` to check:

```txt
ohos_static_library("protobuf_lite_static") {
    ...
    if (!is_mingw) {
        if (current_toolchain != host_toolchain) {
            # target build, not host build
            defines = [ "HAVE_HILOG" ]
            external_deps = [ "hilog:libhilog" ]
        }
    } else {
        defines = [ "_FILE_OFFSET_BITS_SET_LSEEK" ]
    }
}
```

We can see that in the `ohos_static_library("protobuf_lite_static")` logic, it simply checks `current_toolchain != host_toolchain` and then adds `external_deps = [ "hilog:libhilog" ]`, which makes `[ hilog:libhilog ]` impossible to handle.

Therefore, we make the following modification:

```txt
# To Append the `enable_hilog` identifier
import("//arkcompiler/runtime_core/ark_config.gni")

ohos_static_library("protobuf_lite_static") {
    ...
    if (!is_mingw) {
        if (enable_hilog && current_toolchain != host_toolchain) {
            # target build, not host build
            defines = [ "HAVE_HILOG" ]
            external_deps = [ "hilog:libhilog" ]
        }
    } else {
        defines = [ "_FILE_OFFSET_BITS_SET_LSEEK" ]
    }
}
```

Now run the `riscv64` build script again:

```bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py riscv64.release --verbose

...

Done. Made 3926 targets from 543 files in 661ms

=== gn gen success! ===
```

#### runtime_core && toolchain

For these two components, there isn't much to note; only the two executables built by `runtime_core`, `ark_asm` and `ark_disasm`, may come in handy later.

```txt
group("runtime_core") {
  deps = [
    "$ark_root/assembler:ark_asm",
    "$ark_root/disassembler:ark_disasm",
  ]
}

group("toolchain") {
  if (target_cpu != "mipsel") {
    deps = [
      "$toolchain_root/inspector:ark_debugger",
      "$toolchain_root/inspector:connectserver_debugger",
      "$toolchain_root/tooling:libark_ecma_debugger",
    ]
  }
}
```

## Compile Show

![ArkTS result](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407011726816.png)
