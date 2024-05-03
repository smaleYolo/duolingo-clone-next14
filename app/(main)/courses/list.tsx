"use client";

import {toast} from "sonner";
import {useTransition} from "react";
import {useRouter} from "next/navigation";

import {courses, userProgress} from "@/db/schema";

import Card from "@/app/(main)/courses/card";
import {upsertUserProgress} from "@/actions/user-progress";

type Props = {
    courses: typeof courses.$inferSelect[];
    activeCourseId?: typeof userProgress.$inferInsert.activeCourseId;
}

const List = ({courses, activeCourseId}: Props) => {
    const router = useRouter(); // Используем хук для маршрутизации
    const [pending, startTransition] = useTransition(); // Хук для управления переходами и отслеживания их состояния

    // Функция обработки клика по карточке курса
    const onClick = (id: number) => {
        if (pending) return; // Если предыдущий переход не завершен, прерываем выполнение функции

        if (id === activeCourseId){
            return router.push('/learn') // Если курс уже активен, перенаправляем пользователя
        }

        // Начинаем новый переход и обновляем прогресс пользователя
        startTransition(() => {
            upsertUserProgress(id)
                .catch(() => toast.error('Something went wrong'));
        })
    }

    return (
        <div className='pt-6 grid grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4'>
            {courses.map(course => (
                <Card
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    imageSrc={course.imageSrc}
                    onClick={onClick}
                    disabled={pending}
                    active={activeCourseId === course.id}
                />
            ))}
        </div>
    )
}

export default List;