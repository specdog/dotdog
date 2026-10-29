#include <stdint.h>

__attribute__((noinline)) int32_t dotdog_scale(int32_t value) {
    return value * 2;
}

__attribute__((noinline)) int32_t dotdog_validate(int32_t value) {
    if (value < 0 || value > 100) return -1;
    return dotdog_scale(value);
}

int main(void) {
    return dotdog_validate(21) == 42 ? 0 : 1;
}
