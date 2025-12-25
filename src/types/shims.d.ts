// Temporary module shims for third-party libraries without types

declare module 'react-day-picker' {
  export const DayPicker: any
  export default DayPicker
}

declare module 'embla-carousel-react' {
  const useEmblaCarousel: any
  export default useEmblaCarousel
  export type UseEmblaCarouselType = any
}

declare module 'cmdk' {
  export const Command: any
  export default Command
}

declare module 'vaul' {
  export const Drawer: any
  export default Drawer
}

declare module 'react-hook-form' {
  export const useForm: any
  export const Controller: any
  export default useForm
}

declare module 'input-otp' {
  export const OTPInput: any
  export type SlotProps = any
  export default OTPInput
}

// declare global ipcRenderer if some legacy code uses it
declare global {
  interface Window {
    ipcRenderer?: any
  }
}

export {}
