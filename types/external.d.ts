declare module '@radix-ui/react-slot' {
  import * as React from 'react'
  export const Slot: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<'span'> & React.RefAttributes<HTMLSpanElement>
  >
}

declare module '@radix-ui/react-label' {
  import * as React from 'react'
  export const Root: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<'label'> & React.RefAttributes<HTMLLabelElement>
  >
}

declare module '@tremor/react' {
  import * as React from 'react'

  export type DeltaType = 'increase' | 'moderateIncrease' | 'moderateDecrease' | 'decrease' | 'unchanged'

  export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { decoration?: string; decorationColor?: string }>
  export const Flex: React.FC<React.HTMLAttributes<HTMLDivElement>>
  export const Metric: React.FC<React.HTMLAttributes<HTMLParagraphElement>>
  export const Text: React.FC<React.HTMLAttributes<HTMLParagraphElement>>
  export const Title: React.FC<React.HTMLAttributes<HTMLHeadingElement>>
  export const BadgeDelta: React.FC<
    React.HTMLAttributes<HTMLSpanElement> & {
      deltaType?: DeltaType
    }
  >
  export const Select: React.FC<
    {
      value?: string
      onValueChange?: (value: string) => void
      placeholder?: string
      className?: string
    } & React.HTMLAttributes<HTMLDivElement>
  >
  export const SelectItem: React.FC<
    React.HTMLAttributes<HTMLDivElement> & {
      value: string
    }
  >
  export const Switch: React.FC<
    React.HTMLAttributes<HTMLButtonElement> & {
      checked?: boolean
      onChange?: (value: boolean) => void
    }
  >
}

declare module '@tremor/react/dist/styles.css'
