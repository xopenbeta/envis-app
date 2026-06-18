import { useEffect } from "react";

// 处理点击外部关闭搜索框
export const useClickOutsideBlur = (props: {
  isSearchExpanded: boolean;
  setIsSearchExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  searchRef: React.RefObject<HTMLDivElement>
}) => {
  const { isSearchExpanded, setIsSearchExpanded, setSearchQuery, searchRef } = props;
  // 点击外部关闭搜索框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchExpanded(false)
        setSearchQuery('')
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchExpanded(false)
        setSearchQuery('')
      }
    }

    if (isSearchExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
    return;
  }, [isSearchExpanded])

}
