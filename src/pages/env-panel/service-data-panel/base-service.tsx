import { Button } from "@/components/ui/button"
import { ServiceData } from "@/types/index"
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
    Bot,
    Save
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { isAIPanelOpenAtom } from "@/store";
// import { useServiceData } from "../../../hooks/env-serv-data"

interface BaseServiceProps {
    service: ServiceData
    children?: React.ReactNode
}

export function BaseService({ service, children }: BaseServiceProps) {
    return (
        <div>
            {children}
        </div>
    )
}
