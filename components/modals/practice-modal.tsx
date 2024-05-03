"use client";

import Image from "next/image";
import {useRouter} from "next/navigation";

import React from "react";
import {useEffect, useState} from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogFooter,
    DialogHeader, DialogDescription
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {usePracticeModal} from "@/store/use-practice-modal";

const PracticeModal = () => {
    const [isClient, setIsClient] = useState(false);
    const {isOpen, close} = usePracticeModal();

    useEffect(() => setIsClient(true), []);

    if (!isClient) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={close}>
            <DialogContent className='max-w-md'>
                <DialogHeader>
                    <div className='flex items-center w-full justify-center mb-5'>
                        <Image
                            src='/heart.svg'
                            alt='Heart'
                            height={80}
                            width={80}
                        />
                    </div>
                    <DialogTitle className='text-center font-bold text-2xl'>
                        Practice Lesson
                    </DialogTitle>
                    <DialogDescription className='text-center text-base'>
                        Use practice lessons to regain hearts and points. You cannot lose hearts or points in practice
                        mode.
                    </DialogDescription>
                    <DialogFooter className='mb-4'>
                        <div className='flex flex-col gap-y-4 w-full'>
                            <Button variant='primary' className='w-full' size='lg' onClick={close}>
                                I understand
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
};

export default PracticeModal;