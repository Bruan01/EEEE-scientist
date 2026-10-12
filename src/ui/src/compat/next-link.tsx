import * as React from 'react'
import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  Pick<RouterLinkProps, 'replace' | 'state' | 'reloadDocument' | 'preventScrollReset' | 'relative'> & {
    href: string
  }

const Link = React.forwardRef<HTMLAnchorElement, Props>(function Link({ href, children, ...rest }, ref) {
  const isExternal = /^https?:\/\//.test(href)
  if (isExternal) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <RouterLink ref={ref} to={href} {...rest}>
      {children}
    </RouterLink>
  )
})

export default Link
